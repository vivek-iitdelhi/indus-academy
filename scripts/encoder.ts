// Video encoder: runs on our own machine, not on Vercel. Every 30 s it looks in the R2
// bucket for new uploads (uploads/<uid>), turns each into adaptive HLS (240p up to the
// source's quality, 6-second segments), uploads it to videos/<uid>/ and writes meta.json,
// which marks the video ready. It also deletes videos queued in trash/.
// Bucket layout: see src/lib/video.ts. Setup: docs/lms-go-live.md.
//
//   node --env-file=.env.encoder scripts/encoder.ts          # keep running
//   node --env-file=.env.encoder scripts/encoder.ts --once   # one pass, then exit
//
// Needs ffmpeg/ffprobe on PATH and R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY. VIDEO_ENCODER=h264_nvenc encodes on an NVIDIA GPU (default libx264).
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { r2Fetch } from "../src/lib/video.ts";

const POLL_MS = 30_000;
// Deleted videos stay until every playback link to them has expired (links last ≤ 24 h).
const PURGE_AFTER_MS = 25 * 3_600_000;
const RETRY_DELAYS_MS = [1000, 5000, 20_000];
const SEGMENT_SECONDS = 6;
const PARALLEL_REQUESTS = 16;
const WORK_DIR = process.env.ENCODER_WORK_DIR ?? join(tmpdir(), "iaa-encoder");
const CODEC = process.env.VIDEO_ENCODER ?? "libx264";
// Height of the short side, and video bitrate in kbps. Rungs above the source are skipped.
const LADDER = [
  { size: 240, kbps: 250 },
  { size: 360, kbps: 450 },
  { size: 480, kbps: 800 },
  { size: 720, kbps: 1800 },
  { size: 1080, kbps: 3500 },
  { size: 1440, kbps: 6000 },
];
const CONTENT_TYPES: Record<string, string> = { m3u8: "application/vnd.apple.mpegurl", ts: "video/mp2t", jpg: "image/jpeg", json: "application/json" };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

async function ok(res: Response, what: string) {
  if (!res.ok) throw new Error(`${what} responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

/** Retries network errors and 5xx (with backoff); other statuses are returned as they are. */
async function request(...args: Parameters<typeof r2Fetch>) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await r2Fetch(...args);
      if (res.status < 500 || attempt >= RETRY_DELAYS_MS.length) return res;
    } catch (e) {
      if (attempt >= RETRY_DELAYS_MS.length) throw e;
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

async function list(prefix: string) {
  const objects: { key: string; lastModified: Date }[] = [];
  let token: string | undefined;
  do {
    const query: Record<string, string> = { "list-type": "2", prefix, ...(token && { "continuation-token": token }) };
    const xml = await (await ok(await request("GET", "", { query }), `list ${prefix}`)).text();
    for (const [, body] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = body.match(/<Key>([^<]+)<\/Key>/)?.[1];
      const lastModified = new Date(body.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] ?? 0);
      if (key) objects.push({ key, lastModified });
    }
    token = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1];
  } while (token);
  return objects;
}

/** Runs `task` on every item, at most PARALLEL_REQUESTS at a time. */
async function each<T>(items: T[], task: (item: T) => Promise<unknown>) {
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) await task(items[i]);
  };
  await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, worker));
}

const remove = async (key: string) => {
  const res = await request("DELETE", key);
  if (!res.ok && res.status !== 404) await ok(res, `delete ${key}`);
};

const put = async (key: string, body: Blob | string) =>
  ok(await request("PUT", key, { body, headers: { "content-type": CONTENT_TYPES[key.split(".").pop()!] ?? "application/octet-stream" }, timeoutMs: 120_000 }), `put ${key}`);

/** Runs a command; resolves with stdout, rejects with the end of stderr. */
function run(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${command} exited ${code}: ${err}`))));
  });
}

async function probe(file: string) {
  const json = JSON.parse(
    await run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", file]),
  ) as { format?: { duration?: string }; streams?: { codec_type: string; width?: number; height?: number }[] };
  const video = json.streams?.find((s) => s.codec_type === "video" && s.width && s.height);
  const durationSeconds = Number(json.format?.duration);
  if (!video || !(durationSeconds > 0)) throw new Error("No video stream or duration found; is this a video file?");
  return {
    durationSeconds,
    shortSide: Math.min(video.width!, video.height!),
    hasAudio: Boolean(json.streams?.some((s) => s.codec_type === "audio")),
  };
}

function ffmpegArgs(source: string, out: string, { shortSide, hasAudio }: { shortSide: number; hasAudio: boolean }) {
  const fitting = LADDER.filter((r) => r.size <= shortSide);
  const rungs = fitting.length ? fitting : [{ size: shortSide - (shortSide % 2), kbps: LADDER[0].kbps }];
  // Scale the short side, so portrait videos get the same ladder as landscape ones.
  const scale = (size: number) => `scale='if(gt(iw,ih),-2,${size})':'if(gt(iw,ih),${size},-2)'`;
  const filter = [
    `[0:v]split=${rungs.length}${rungs.map((_, i) => `[s${i}]`).join("")}`,
    ...rungs.map((r, i) => `[s${i}]${scale(r.size)}[v${i}]`),
  ].join(";");
  return [
    ...["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", source, "-filter_complex", filter],
    ...rungs.flatMap((_, i) => ["-map", `[v${i}]`, ...(hasAudio ? ["-map", "0:a:0"] : [])]),
    ...["-c:v", CODEC, "-profile:v", "main", "-pix_fmt", "yuv420p"],
    ...(CODEC === "libx264" ? ["-preset", "medium", "-sc_threshold", "0"] : ["-preset", "p5", "-forced-idr", "1"]),
    ...["-force_key_frames", `expr:gte(t,n_forced*${SEGMENT_SECONDS})`],
    ...rungs.flatMap((r, i) => [`-b:v:${i}`, `${r.kbps}k`, `-maxrate:v:${i}`, `${Math.round(r.kbps * 1.1)}k`, `-bufsize:v:${i}`, `${r.kbps * 2}k`]),
    ...(hasAudio ? ["-c:a", "aac", "-b:a", "64k", "-ac", "2"] : []),
    ...["-f", "hls", "-hls_time", String(SEGMENT_SECONDS), "-hls_playlist_type", "vod", "-hls_flags", "independent_segments"],
    ...["-master_pl_name", "master.m3u8", "-var_stream_map", rungs.map((_, i) => (hasAudio ? `v:${i},a:${i}` : `v:${i}`)).join(" ")],
    ...["-hls_segment_filename", join(out, "%v", "seg_%04d.ts"), join(out, "%v", "index.m3u8")],
  ];
}

const MACHINE_TROUBLE = /No space left|ENOSPC|Cannot allocate memory|out of memory|ENOENT|nvenc|CUDA|OpenEncodeSessionEx/i;

async function reject(uid: string, e: unknown) {
  log(uid, "failed", e);
  await put(`videos/${uid}/error.txt`, String(e instanceof Error ? e.message : e));
  await remove(`uploads/${uid}`);
}

async function encode(uid: string) {
  const work = join(WORK_DIR, uid);
  const source = join(work, "source");
  const out = join(work, "out");
  await rm(work, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  try {
    log(uid, "downloading");
    const res = await ok(await request("GET", `uploads/${uid}`, { timeoutMs: 6 * 3_600_000 }), "download");
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(source));

    // A file ffprobe can't read is the upload's fault: tell the admin and drop it.
    let info: Awaited<ReturnType<typeof probe>>;
    try {
      info = await probe(source);
    } catch (e) {
      await reject(uid, e);
      return;
    }
    const { durationSeconds } = info;
    log(uid, `encoding ${Math.round(durationSeconds)} s, short side ${info.shortSide}px, ${CODEC}`);
    const started = Date.now();
    try {
      await run("ffmpeg", ffmpegArgs(source, out, info));
      const at = Math.min(5, durationSeconds / 3).toFixed(2);
      await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-ss", at, "-i", source, "-frames:v", "1", "-vf", "scale=-2:720", "-q:v", "3", join(out, "thumb.jpg")]);
    } catch (e) {
      // The machine's fault (disk, memory, GPU): keep the upload and try again next pass.
      if (MACHINE_TROUBLE.test(String(e))) throw e;
      await reject(uid, e);
      return;
    }
    log(uid, `encoded in ${Math.round((Date.now() - started) / 1000)} s`);

    const files = (await readdir(out, { recursive: true, withFileTypes: true })).filter((f) => f.isFile());
    log(uid, `uploading ${files.length} files`);
    await each(files, async (f) => {
      const path = join(f.parentPath, f.name);
      await put(`videos/${uid}/${relative(out, path).split("\\").join("/")}`, new Blob([await readFile(path)]));
    });
    await put(`videos/${uid}/meta.json`, JSON.stringify({ durationSeconds })); // last: marks it ready
    await remove(`uploads/${uid}`);
    log(uid, "ready");
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function purge(uid: string) {
  const keys = (await list(`videos/${uid}/`)).map((o) => o.key);
  log(uid, `deleting ${keys.length} files`);
  await each([...keys, `uploads/${uid}`], remove);
  await remove(`trash/${uid}`);
}

const uidOf = (key: string) => {
  const uid = key.slice(key.indexOf("/") + 1);
  return /^[\w-]+$/.test(uid) ? uid : null;
};

/** Runs one job; a failure is logged and retried next pass without holding up the others. */
const attempt = (what: string, uid: string, job: () => Promise<void>) =>
  job().catch((e) => log(uid, `${what} failed, will retry`, e));

async function pass() {
  const trash = await list("trash/");
  const trashed = new Set(trash.map((o) => uidOf(o.key)));
  for (const { key, lastModified } of trash) {
    const uid = uidOf(key);
    if (uid && Date.now() - lastModified.getTime() > PURGE_AFTER_MS) await attempt("delete", uid, () => purge(uid));
  }
  for (const { key } of await list("uploads/")) {
    const uid = uidOf(key);
    if (uid && !trashed.has(uid)) await attempt("encode", uid, () => encode(uid));
  }
}

/** Refuses to start without ffmpeg, or with a GPU encoder that doesn't work. */
async function preflight() {
  await run("ffprobe", ["-version"]);
  await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:duration=1", "-c:v", CODEC, "-f", "null", "-"]);
}

// Lets the admin panel tell "processing" from "encoder machine is off". Runs on its own
// timer because one encode can take hours.
const heartbeat = () =>
  put("encoder/heartbeat.json", JSON.stringify({ at: new Date().toISOString(), codec: CODEC })).catch((e) =>
    log("heartbeat failed", e),
  );

const once = process.argv.includes("--once");
try {
  await preflight();
} catch (e) {
  log(`cannot encode with ${CODEC}; is ffmpeg installed (with this encoder)?`, e);
  process.exit(1);
}
log(`encoder started (${CODEC}, work dir ${WORK_DIR})`);
await heartbeat();
const heartbeats = once ? undefined : setInterval(heartbeat, 60_000);
for (;;) {
  // Network or storage errors: log and try again next pass; the upload stays queued.
  await pass().catch((e) => log("pass failed", e));
  if (once) break;
  await sleep(POLL_MS);
}
clearInterval(heartbeats);
