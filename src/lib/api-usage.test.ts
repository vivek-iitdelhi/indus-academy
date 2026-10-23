import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { distributors } from "../db/schema.ts";
import { daysInWindow, endpointOf, recordApiRequest, usageByDay, usageByDistributor, usageByEndpoint } from "./api-usage.ts";

test("endpointOf: method plus route pattern, ids replaced", () => {
  const u = (path: string) => `https://indusai.academy/api/v1${path}`;
  assert.equal(endpointOf("GET", u("/courses")), "GET /courses");
  assert.equal(endpointOf("GET", u("/courses/html-basics")), "GET /courses/{slug}");
  assert.equal(endpointOf("GET", u("/lessons/7f6a95e5-028b-47c7-9bca-a74d5ed4531e/playback?ttl=300")), "GET /lessons/{id}/playback");
  assert.equal(endpointOf("PUT", u("/learners/u%20123")), "PUT /learners/{id}");
  assert.equal(endpointOf("POST", u("/learners/bulk")), "POST /learners/bulk");
  assert.equal(endpointOf("POST", u("/learners/u_1/completions")), "POST /learners/{id}/completions");
  assert.equal(endpointOf("DELETE", u("/learners/u_1/completions/html-basics")), "DELETE /learners/{id}/completions/{course}");
  assert.equal(endpointOf("GET", u("/learners/u_1/certificates")), "GET /learners/{id}/certificates");
  assert.equal(endpointOf("GET", u("/learners/u_1/certificates/html-basics")), "GET /learners/{id}/certificates/{course}");
  assert.equal(endpointOf("POST", u("/completions/bulk")), "POST /completions/bulk");
  assert.equal(endpointOf("GET", u("/batches")), "GET /batches");
  assert.equal(endpointOf("GET", u("/nope/x")), "GET other");
});

test("daysInWindow: consecutive India-time days ending today", () => {
  const now = new Date("2026-10-23T20:00:00Z"); // 01:30 on the 24th in India
  assert.deepEqual(daysInWindow(3, now), ["2026-10-22", "2026-10-23", "2026-10-24"]);
});

// Against a real database: DATABASE_URL=postgres://localhost/indus_lms npm test
describe("api usage", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const ids: string[] = [];
  after(async () => {
    if (ids.length) await db.delete(distributors).where(inArray(distributors.id, ids));
    await db.$client.end();
  });

  test("counts requests and errors per endpoint and per day (India time)", async () => {
    const [d] = await db.insert(distributors).values({ name: "Usage test", keyPrefix: "iaa_live_test", keyHash: randomUUID() }).returning();
    ids.push(d.id);
    const now = new Date("2026-10-23T20:00:00Z"); // 01:30 on the 24th in India
    const yesterday = new Date("2026-10-22T10:00:00Z");
    await recordApiRequest(d.id, "GET /courses", 200, now);
    await recordApiRequest(d.id, "GET /courses", 200, now);
    await recordApiRequest(d.id, "GET /courses", 401, now);
    await recordApiRequest(d.id, "GET /batches", 500, yesterday);

    const byEndpoint = await usageByEndpoint(d.id, 30, now);
    assert.deepEqual(
      byEndpoint.map((r) => [r.endpoint, r.requests, r.errors]),
      [
        ["GET /courses", 3, 1],
        ["GET /batches", 1, 1],
      ],
    );
    const byDay = await usageByDay(d.id, 30, now);
    assert.deepEqual(
      byDay.map((r) => [r.day, r.requests, r.errors]),
      [
        ["2026-10-22", 1, 1],
        ["2026-10-24", 3, 1],
      ],
    );
    assert.equal((await usageByDay(d.id, 1, now)).length, 1); // today only
    const totals = await usageByDistributor(7, now);
    assert.deepEqual(totals.get(d.id), { requests: 4, errors: 2 });
    // null = every client: includes this one's rows
    const all = await usageByEndpoint(null, 30, now);
    assert.ok((all.find((r) => r.endpoint === "GET /courses")?.requests ?? 0) >= 3);
    assert.ok((await usageByDay(null, 30, now)).some((r) => r.day === "2026-10-24" && r.requests >= 3));
  });
});
