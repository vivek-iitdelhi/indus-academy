#!/usr/bin/env node
// Closed-loop HTTP load test. Node 20+, built-in fetch only.
//
//   node scripts/load-test.mjs --base http://localhost:3987 --concurrency 10,20,40 --duration 30 \
//     --cookies /tmp/cookies.txt --lesson <video lesson uuid> --api-key iaa_live_...
//
// Each `--concurrency` value is one step: that many workers loop back-to-back for `--duration`
// seconds, each picking a route by `--mix` weight. Prints req/s, p50/p95/p99 and errors per route.
//
// Routes (use in --mix as name=weight):
//   home, courses, course, blog, article   catalogue pages (GET, gzip like a browser)
//   progress   POST /api/learn/progress, what the player sends every 15 s. Needs --cookies (one
//              `better-auth.session_token=...` per line, each user enrolled in --lesson's course)
//   api        GET /api/v1/courses with --api-key (partner API)
//   playlist   GET --playlist (an /api/video/... URL with a valid ?t= token); off unless weighted
// Video segments come from storage, not the app, so they are not modelled.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: o } = parseArgs({
  options: {
    base: { type: "string", default: "http://localhost:3000" },
    concurrency: { type: "string", default: "10" },
    duration: { type: "string", default: "30" },
    warmup: { type: "string", default: "5" },
    mix: { type: "string", default: "home=8,courses=8,course=12,blog=5,article=7,progress=58,api=2" },
    "course-slug": { type: "string", default: "chatgpt-for-professionals" },
    "blog-slug": { type: "string", default: "ai-agents-for-business" },
    cookies: { type: "string" },
    lesson: { type: "string" },
    "api-key": { type: "string", default: process.env.LOADTEST_API_KEY },
    playlist: { type: "string" },
    timeout: { type: "string", default: "10" },
  },
});

const base = o.base.replace(/\/$/, "");
const cookies = o.cookies ? readFileSync(o.cookies, "utf8").split("\n").map((l) => l.trim()).filter(Boolean) : [];
const get = (path, headers = {}) => () => [base + path, { headers }];
const routes = {
  home: get("/"),
  courses: get("/courses"),
  course: get(`/courses/${o["course-slug"]}`),
  blog: get("/blog"),
  article: get(`/blog/${o["blog-slug"]}`),
  progress: (w) => [
    `${base}/api/learn/progress`,
    {
      method: "POST",
      headers: { cookie: cookies[w % cookies.length], "content-type": "application/json" },
      // Constant position keeps the lesson from completing; watchedDelta is what 15 s of play sends.
      body: JSON.stringify({ lessonId: o.lesson, position: 10, watchedDelta: 15 }),
    },
  ],
  api: get("/api/v1/courses", { authorization: `Bearer ${o["api-key"]}` }),
  playlist: () => [o.playlist?.startsWith("http") ? o.playlist : base + o.playlist, {}],
};

const mix = o.mix.split(",").map((kv) => {
  const [name, w] = kv.split("=");
  if (!routes[name]) throw new Error(`unknown route in --mix: ${name}`);
  return { name, w: Number(w) };
}).filter((r) => r.w > 0);
const need = (cond, msg) => { if (!cond) { console.error(msg); process.exit(1); } };
const uses = (n) => mix.some((r) => r.name === n);
need(!uses("progress") || (cookies.length && o.lesson), "progress needs --cookies and --lesson");
need(!uses("api") || o["api-key"], "api needs --api-key (or LOADTEST_API_KEY)");
need(!uses("playlist") || o.playlist, "playlist needs --playlist");
const totalW = mix.reduce((s, r) => s + r.w, 0);
const pick = () => {
  let x = Math.random() * totalW;
  for (const r of mix) if ((x -= r.w) < 0) return r.name;
  return mix[mix.length - 1].name;
};

async function hit(name, worker, stats) {
  const [url, init] = routes[name](worker);
  const t0 = performance.now();
  let status;
  try {
    const res = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(Number(o.timeout) * 1000) });
    await res.arrayBuffer(); // latency includes the full body
    status = res.status;
  } catch (e) {
    status = e.name === "TimeoutError" ? "timeout" : e.cause?.code ?? e.name;
  }
  if (!stats) return;
  const s = (stats[name] ??= { ms: [], errors: {} });
  s.ms.push(performance.now() - t0);
  if (typeof status !== "number" || status >= 400) s.errors[status] = (s.errors[status] ?? 0) + 1;
}

async function run(concurrency, seconds, stats) {
  const end = performance.now() + seconds * 1000;
  await Promise.all(Array.from({ length: concurrency }, async (_, w) => {
    while (performance.now() < end) await hit(pick(), w, stats);
  }));
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
const pad = (v, n) => String(v).padStart(n);
function report(concurrency, seconds, stats) {
  console.log(`\nconcurrency ${concurrency}, ${seconds}s`);
  console.log(`${"route".padEnd(10)}${pad("reqs", 8)}${pad("req/s", 9)}${pad("p50ms", 8)}${pad("p95ms", 8)}${pad("p99ms", 8)}${pad("err%", 7)}  errors`);
  const all = { ms: [], errors: {} };
  for (const [name, s] of [...Object.entries(stats), ["TOTAL", all]]) {
    if (name !== "TOTAL") {
      all.ms.push(...s.ms);
      for (const [k, v] of Object.entries(s.errors)) all.errors[k] = (all.errors[k] ?? 0) + v;
    }
    const sorted = s.ms.toSorted((a, b) => a - b);
    const errs = Object.values(s.errors).reduce((a, b) => a + b, 0);
    console.log(
      name.padEnd(10) + pad(sorted.length, 8) + pad((sorted.length / seconds).toFixed(1), 9) +
      pad(pct(sorted, 50).toFixed(0), 8) + pad(pct(sorted, 95).toFixed(0), 8) + pad(pct(sorted, 99).toFixed(0), 8) +
      pad(((100 * errs) / (sorted.length || 1)).toFixed(1), 7) + "  " +
      Object.entries(s.errors).map(([k, v]) => `${k}:${v}`).join(" "),
    );
  }
}

console.log(`base ${base}  mix ${mix.map((r) => `${r.name}=${r.w}`).join(",")}`);
const steps = o.concurrency.split(",").map(Number);
if (Number(o.warmup) > 0) await run(steps[0], Number(o.warmup), null);
for (const c of steps) {
  const stats = {};
  await run(c, Number(o.duration), stats);
  report(c, Number(o.duration), stats);
}
