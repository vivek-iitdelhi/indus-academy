import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { after, before, describe, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { distributors, partnerWebhookEvents } from "../db/schema.ts";
import { createDistributorWithKey } from "./distributors.ts";
import {
  deliverDueWebhooks,
  generateWebhookSecret,
  listWebhookEvents,
  nextAttemptAt,
  queueWebhookEvent,
  retryWebhookEvents,
  signWebhook,
} from "./partner-webhooks.ts";

test("signature: t=<unix>,v1=hex HMAC-SHA256 of '<t>.<body>'", () => {
  const secret = generateWebhookSecret();
  assert.match(secret, /^whsec_[A-Za-z0-9_-]{43}$/);
  const body = '{"id":"e1"}';
  const expected = createHmac("sha256", secret).update(`1761645600.${body}`).digest("hex");
  assert.equal(signWebhook(secret, body, 1761645600), `t=1761645600,v1=${expected}`);
});

test("backoff: 1, 2, 4 … minutes, at most 4 h apart, giving up after 24 h", () => {
  const created = new Date("2026-10-28T00:00:00Z");
  const min = (attempts: number, now = created) => {
    const next = nextAttemptAt(created, attempts, now);
    return next && (next.getTime() - now.getTime()) / 60_000;
  };
  assert.deepEqual([1, 2, 3, 4, 8, 9, 20].map((a) => min(a)), [1, 2, 4, 8, 128, 240, 240]);
  assert.equal(min(12, new Date("2026-10-28T19:00:00Z")), 240); // 23:00, still inside 24 h
  assert.equal(min(13, new Date("2026-10-28T21:00:00Z")), null); // would be 01:00 the next day
});

// Against a real database: DATABASE_URL=postgres://localhost/indus_lms_platform npm test
describe("delivery", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const received: { headers: IncomingMessage["headers"]; body: string }[] = [];
  let status = 200;
  let server: Server;
  let url = "";
  const ids: string[] = [];

  before(async () => {
    // Clear leftovers so only this run's events are due.
    await db.update(partnerWebhookEvents).set({ nextAttemptAt: null });
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () =>
        // slow enough that two workers overlap
        setTimeout(() => {
          received.push({ headers: req.headers, body });
          res.writeHead(status).end("ok");
        }, 30),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}/hooks`;
  });
  after(async () => {
    server.close();
    if (ids.length) await db.delete(distributors).where(inArray(distributors.id, ids));
    await db.$client.end();
  });
  async function partner(webhookUrl: string | null) {
    const { distributor } = await createDistributorWithKey({ name: "Webhook test", contactEmail: null });
    ids.push(distributor.id);
    const secret = generateWebhookSecret();
    await db.update(distributors).set({ webhookUrl, webhookSecret: secret }).where(eq(distributors.id, distributor.id));
    return { id: distributor.id, secret };
  }

  test("no webhook URL: nothing is queued", async () => {
    const { id } = await partner(null);
    assert.equal(await queueWebhookEvent(id, "batch.paid", { batch: "Jan" }), null);
  });

  test("delivers a signed event once; the partner can verify it", async () => {
    const { id, secret } = await partner(url);
    const eventId = await queueWebhookEvent(id, "certificate.released", { external_id: "u_1", course: "html" });
    assert.ok(eventId);
    received.length = 0;
    assert.deepEqual(await deliverDueWebhooks(), { delivered: 1, failed: 0 });
    assert.equal(received.length, 1);
    const { headers, body } = received[0];
    const event = JSON.parse(body);
    assert.equal(event.id, eventId);
    assert.equal(event.type, "certificate.released");
    assert.deepEqual(event.data, { external_id: "u_1", course: "html" });
    assert.equal(headers["x-iaa-event-id"], eventId);
    // what the partner does (docs/pending/platform.md)
    const [, t, v1] = String(headers["x-iaa-signature"]).match(/^t=(\d+),v1=([0-9a-f]{64})$/)!;
    assert.equal(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"), v1);
    assert.ok(Math.abs(Date.now() / 1000 - Number(t)) < 60);

    const [row] = await listWebhookEvents(id, "delivered");
    assert.equal(row.id, eventId);
    assert.equal(row.attempts, 1);
    assert.equal(await deliverDueWebhooks().then((r) => r.delivered), 0); // never sent twice
  });

  test("a failed delivery is retried a minute later; a failed event can be retried by hand", async () => {
    const { id } = await partner(url);
    status = 500;
    const eventId = (await queueWebhookEvent(id, "batch.paid", { batch: "Jan" }))!;
    assert.deepEqual(await deliverDueWebhooks(), { delivered: 0, failed: 1 });
    status = 200;
    const [row] = await db.select().from(partnerWebhookEvents).where(eq(partnerWebhookEvents.id, eventId));
    assert.equal(row.attempts, 1);
    assert.equal(row.lastError, "HTTP 500");
    const wait = row.nextAttemptAt!.getTime() - Date.now();
    assert.ok(wait > 50_000 && wait <= 60_000, `next try in ${wait} ms`);
    assert.equal((await listWebhookEvents(id, "pending")).length, 1);

    // given up (as after 24 h): shows as failed, and Retry puts it back for one more try
    await db.update(partnerWebhookEvents).set({ nextAttemptAt: null }).where(eq(partnerWebhookEvents.id, eventId));
    assert.equal((await listWebhookEvents(id, "failed")).length, 1);
    assert.equal(await retryWebhookEvents(id, eventId), 1);
    assert.deepEqual(await deliverDueWebhooks(), { delivered: 1, failed: 0 });
    assert.equal((await listWebhookEvents(id, "failed")).length, 0);
  });

  test("two workers at once never send the same event twice (SKIP LOCKED)", async () => {
    const { id } = await partner(url);
    const queued = new Set<string>();
    for (let i = 0; i < 150; i++) queued.add((await queueWebhookEvent(id, "course.updated", { i }))!);
    received.length = 0;
    const [a, b] = await Promise.all([deliverDueWebhooks(), deliverDueWebhooks()]);
    assert.equal(a.delivered + b.delivered, 150);
    assert.ok(a.delivered > 0 && b.delivered > 0, `split ${a.delivered}/${b.delivered}`);
    const sent = received.map((r) => JSON.parse(r.body).id);
    assert.equal(sent.length, 150);
    assert.deepEqual(new Set(sent), queued);
  });
});
