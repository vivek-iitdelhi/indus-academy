// Video encoder: runs on our own machine, not on Vercel. Every 30 s it looks in the R2
// bucket for new uploads (uploads/<uid>), turns each into adaptive HLS (240p up to the
// source's quality, plus 144p and audio only for weak networks; 6-second segments), encrypts
// the segments (AES-128, key in enc.key), uploads it to videos/<uid>/ and writes meta.json,
// which marks the video ready. It also deletes videos queued in trash/.
// Bucket layout: see src/lib/video.ts. Setup: docs/lms-go-live.md.
//
//   node --env-file=.env.encoder scripts/encoder.ts          # keep running
//   node --env-file=.env.encoder scripts/encoder.ts --once   # one pass, then exit
//   node --env-file=.env.encoder scripts/encoder.ts --add-low-rungs [--dry-run] [--only <uid>]
//                                                            # backfill, see addLowRungs
//
// Needs ffmpeg/ffprobe on PATH and R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY. VIDEO_ENCODER=h264_nvenc encodes on an NVIDIA GPU (default libx264).
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { decryptSegment, encryptPlaylist, encryptSegment, KEY_FILE, newVideoKey } from "../src/lib/hls-crypto.ts";
import { r2Fetch } from "../src/lib/video.ts";

const POLL_MS = 30_000;
// Deleted videos stay until every playback link to them has expired (links last ≤ 24 h).
const PURGE_AFTER_MS = 25 * 3_600_000;
const RETRY_DELAYS_MS = [1000, 5000, 20_000];
const SEGMENT_SECONDS = 6;
const PARALLEL_REQUESTS = 16;
const WORK_DIR = process.env.ENCODER_WORK_DIR ?? join(tmpdir(), "iaa-encoder");
const CODEC = process.env.VIDEO_ENCODER ?? "libx264";
const AUDIO = { kbps: 64, channels: 2 };
// Speech-grade audio for weak networks: mono AAC-LC. Not HE-AAC: ffmpeg's own aac encoder can't
// write it. Keep the source sample rate: hls.js signals AAC at ≤ 24 kHz as HE-AAC.
const SPEECH_AUDIO = { kbps: 48, channels: 1 };
// Height of the short side, and video bitrate in kbps. Rungs above the source are skipped.
const LADDER = [
  { size: 240, kbps: 250, audio: AUDIO },
  { size: 360, kbps: 450, audio: AUDIO },
  { size: 480, kbps: 800, audio: AUDIO },
  { size: 720, kbps: 1800, audio: AUDIO },
  { size: 1080, kbps: 3500, audio: AUDIO },
  { size: 1440, kbps: 6000, audio: AUDIO },
];
// For rural 2G and weak 3G: ~150 kbps as delivered. MPEG-TS adds ~10% here, ~25% at 30 fps,
// where the frames are tiny; 15 fps also gives each frame more bits. Listed after the ladder:
// native players start on the first listed rung, and videos encoded before it keep their rung
// numbers (--add-low-rungs appends it the same way). An audio-only rendition follows it.
type Rung = { size: number; kbps: number; audio: typeof AUDIO; fps?: number };
const LOW_RUNG: Rung = { size: 144, kbps: 85, audio: SPEECH_AUDIO, fps: 15 };
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

/** The video rungs for a source, in master playlist order. */
export function rungsFor(shortSide: number): Rung[] {
  const fitting = LADDER.filter((r) => r.size <= shortSide);
  const rungs = fitting.length ? fitting : [{ ...LADDER[0], size: shortSide - (shortSide % 2) }];
  return shortSide > LOW_RUNG.size ? [...rungs, LOW_RUNG] : rungs;
}

/**
 * ffmpeg arguments for HLS of `rungs` (plus the audio-only rendition if there's audio) in
 * out/<n>/, numbered from `first`, and their master playlist in out/master.m3u8.
 */
export function ffmpegArgs(source: string, out: string, { rungs, hasAudio, first = 0 }: { rungs: Rung[]; hasAudio: boolean; first?: number }) {
  const audios = hasAudio ? [...rungs.map((r) => r.audio), SPEECH_AUDIO] : [];
  const streams = [
    ...rungs.map((_, i) => (hasAudio ? `v:${i},a:${i}` : `v:${i}`)),
    ...(hasAudio ? [`a:${rungs.length}`] : []),
  ].map((s, i) => `${s},name:${first + i}`);
  // Scale the short side, so portrait videos get the same ladder as landscape ones.
  const scale = (size: number) => `scale='if(gt(iw,ih),-2,${size})':'if(gt(iw,ih),${size},-2)'`;
  const filter = [
    `[0:v]split=${rungs.length}${rungs.map((_, i) => `[s${i}]`).join("")}`,
    ...rungs.map((r, i) => `[s${i}]${scale(r.size)}${r.fps ? `,fps=${r.fps}` : ""}[v${i}]`),
  ].join(";");
  return [
    ...["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", source, "-filter_complex", filter],
    ...rungs.flatMap((_, i) => ["-map", `[v${i}]`, ...(hasAudio ? ["-map", "0:a:0"] : [])]),
    ...(hasAudio ? ["-map", "0:a:0"] : []),
    ...["-c:v", CODEC, "-profile:v", "main", "-pix_fmt", "yuv420p"],
    ...(CODEC === "libx264" ? ["-preset", "medium", "-sc_threshold", "0"] : ["-preset", "p5", "-forced-idr", "1"]),
    ...["-force_key_frames", `expr:gte(t,n_forced*${SEGMENT_SECONDS})`],
    ...rungs.flatMap((r, i) => [`-b:v:${i}`, `${r.kbps}k`, `-maxrate:v:${i}`, `${Math.round(r.kbps * 1.1)}k`, `-bufsize:v:${i}`, `${r.kbps * 2}k`]),
    ...(hasAudio ? ["-c:a", "aac"] : []),
    ...audios.flatMap((a, i) => [`-b:a:${i}`, `${a.kbps}k`, `-ac:a:${i}`, String(a.channels)]),
    ...["-f", "hls", "-hls_time", String(SEGMENT_SECONDS), "-hls_playlist_type", "vod", "-hls_flags", "independent_segments"],
    ...["-master_pl_name", "master.m3u8", "-var_stream_map", streams.join(" ")],
    ...["-hls_segment_filename", join(out, "%v", "seg_%04d.ts"), join(out, "%v", "index.m3u8")],
  ];
}

const MACHINE_TROUBLE = /No space left|ENOSPC|Cannot allocate memory|out of memory|ENOENT|nvenc|CUDA|OpenEncodeSessionEx/i;

async function reject(uid: string, e: unknown) {
  log(uid, "failed", e);
  await put(`videos/${uid}/error.txt`, String(e instanceof Error ? e.message : e));
  await remove(`uploads/${uid}`);
  await remove(`imports/${uid}`);
}

/**
 * The source to encode: the admin's upload (uploads/<uid>), or for an import (imports/<uid>,
 * whose body is an https URL: a live class recording) the file at that URL.
 */
async function download(uid: string, from: "uploads" | "imports") {
  if (from === "uploads") return ok(await request("GET", `uploads/${uid}`, { timeoutMs: 6 * 3_600_000 }), "download");
  const url = (await (await ok(await request("GET", `imports/${uid}`), "read import")).text()).trim();
  if (!url.startsWith("https://")) throw new Error(`imports/${uid} is not an https URL`);
  return ok(await fetch(url, { signal: AbortSignal.timeout(6 * 3_600_000) }), "download import");
}

async function encode(uid: string, from: "uploads" | "imports" = "uploads") {
  const work = join(WORK_DIR, uid);
  const source = join(work, "source");
  const out = join(work, "out");
  await rm(work, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  try {
    log(uid, "downloading");
    const res = await download(uid, from);
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
      await run("ffmpeg", ffmpegArgs(source, out, { rungs: rungsFor(info.shortSide), hasAudio: info.hasAudio }));
      const at = Math.min(5, durationSeconds / 3).toFixed(2);
      await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-ss", at, "-i", source, "-frames:v", "1", "-vf", "scale=-2:720", "-q:v", "3", join(out, "thumb.jpg")]);
    } catch (e) {
      // The machine's fault (disk, memory, GPU): keep the upload and try again next pass.
      if (MACHINE_TROUBLE.test(String(e))) throw e;
      await reject(uid, e);
      return;
    }
    log(uid, `encoded in ${Math.round((Date.now() - started) / 1000)} s`);
    await encryptOutput(out);

    const files = (await readdir(out, { recursive: true, withFileTypes: true })).filter((f) => f.isFile());
    log(uid, `uploading ${files.length} files`);
    await each(files, async (f) => {
      const path = join(f.parentPath, f.name);
      await put(`videos/${uid}/${relative(out, path).split("\\").join("/")}`, new Blob([await readFile(path)]));
    });
    await put(`videos/${uid}/meta.json`, JSON.stringify({ durationSeconds })); // last: marks it ready
    await remove(`${from}/${uid}`);
    log(uid, "ready");
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Encrypts every rung's segments in place and writes the key; see src/lib/hls-crypto.ts. */
async function encryptOutput(out: string, key = newVideoKey()) {
  const playlists = (await readdir(out, { recursive: true, withFileTypes: true })).filter(
    (f) => f.isFile() && f.name === "index.m3u8",
  );
  for (const f of playlists) {
    const file = join(f.parentPath, f.name);
    const { text, segments } = encryptPlaylist(await readFile(file, "utf8"));
    for (const seg of segments) {
      const path = join(f.parentPath, seg.from);
      await writeFile(path, encryptSegment(await readFile(path), key, seg.sequence));
    }
    await writeFile(file, text);
  }
  await writeFile(join(out, KEY_FILE), key);
}

async function purge(uid: string) {
  const keys = (await list(`videos/${uid}/`)).map((o) => o.key);
  log(uid, `deleting ${keys.length} files`);
  await each([...keys, `uploads/${uid}`, `imports/${uid}`], remove);
  await remove(`trash/${uid}`);
}

// --- Backfill: low-bandwidth rungs for videos encoded before them --------------------------
// The 144p rung and the audio-only rendition are encoded from one existing rung (the original
// upload is gone), encrypted with the video's key, uploaded as the next rung numbers, and only
// then added to master.m3u8, so players never see a rung that isn't there. Other rungs are left
// alone. Safe to re-run: videos that already have a 144p rung are skipped.

const VARIANT = /^#EXT-X-STREAM-INF:(.*)\n(.+)$/gm;

/** The variants of a master playlist: their URI, BANDWIDTH and short side. */
export const variantsOf = (master: string) =>
  [...master.matchAll(VARIANT)].map(([, attrs, uri]) => {
    const [, w, h] = /RESOLUTION=(\d+)x(\d+)/.exec(attrs) ?? [];
    return { uri: uri.trim(), bandwidth: Number(/BANDWIDTH=(\d+)/.exec(attrs)?.[1] ?? 0), shortSide: w ? Math.min(+w, +h) : 0 };
  });

/** `master` with the variants of `extra`, another master playlist, appended. */
export const addVariants = (master: string, extra: string) =>
  `${master.trimEnd()}\n${extra.slice(extra.indexOf("#EXT-X-STREAM-INF")).trimEnd()}\n`;

async function addLowRungs(uid: string, dryRun: boolean) {
  const base = `videos/${uid}/`;
  const master = await (await ok(await request("GET", `${base}master.m3u8`), "get master")).text();
  const variants = variantsOf(master);
  if (variants.some((v) => v.shortSide === LOW_RUNG.size)) return log(uid, "has a 144p rung, skipped");
  // Enough detail for 144p and cheap to download: the best rung up to ~480p.
  const sorted = variants.filter((v) => /^\d+\/index\.m3u8$/.test(v.uri)).sort((a, b) => a.bandwidth - b.bandwidth);
  const from = sorted.filter((v) => v.bandwidth <= 1_500_000).at(-1) ?? sorted[0];
  if (!from || from.shortSide <= LOW_RUNG.size) return log(uid, "no rung above 144p, skipped");
  const first = Math.max(...sorted.map((v) => parseInt(v.uri))) + 1;

  const work = join(WORK_DIR, `low-${uid}`);
  const src = join(work, "src");
  const out = join(work, "out");
  await rm(work, { recursive: true, force: true });
  await mkdir(src, { recursive: true });
  await mkdir(out);
  try {
    const dir = base + from.uri.slice(0, from.uri.indexOf("/") + 1);
    const playlist = await (await ok(await request("GET", base + from.uri), "get rung")).text();
    if (!playlist.includes("#EXT-X-KEY")) return log(uid, "not encrypted (run scripts/encrypt-videos.ts first), skipped");
    const key = Buffer.from(await (await ok(await request("GET", base + KEY_FILE), "get key")).arrayBuffer());
    // Decrypted here, not by ffmpeg, whose versions differ in what key files they will open.
    await writeFile(join(src, "index.m3u8"), playlist.replace(/^#EXT-X-KEY:.*\n/m, ""));
    const firstSequence = Number(/^#EXT-X-MEDIA-SEQUENCE:(\d+)/m.exec(playlist)?.[1] ?? 0);
    const segments = playlist.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    log(uid, `downloading ${from.uri} (${segments.length} segments)`);
    await each(segments.map((name, i) => ({ name, sequence: firstSequence + i })), async ({ name, sequence }) => {
      const res = await ok(await request("GET", dir + name, { timeoutMs: 120_000 }), `get ${name}`);
      await writeFile(join(src, name), decryptSegment(Buffer.from(await res.arrayBuffer()), key, sequence));
    });

    const { hasAudio } = await probe(join(src, "index.m3u8"));
    await run("ffmpeg", ffmpegArgs(join(src, "index.m3u8"), out, { rungs: [LOW_RUNG], hasAudio, first }));
    await encryptOutput(out, key);
    const added = (await readFile(join(out, "master.m3u8"), "utf8")).trim();
    log(uid, `${dryRun ? "would add" : "adding"}:\n${added.slice(added.indexOf("#EXT-X-STREAM-INF"))}`);
    if (dryRun) return;

    const files = (await readdir(out, { recursive: true, withFileTypes: true })).filter(
      (f) => f.isFile() && f.parentPath !== out, // the rungs only: not their master, not a new key
    );
    await each(files, async (f) => {
      const path = join(f.parentPath, f.name);
      await put(base + relative(out, path).split("\\").join("/"), new Blob([await readFile(path)]));
    });
    await put(`${base}master.m3u8`, addVariants(master, added)); // last: players see the rungs from here
    log(uid, "low rungs added");
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function addLowRungsToAll(dryRun: boolean, only?: string) {
  const keys = (await list("videos/")).map((o) => o.key);
  const trashed = new Set((await list("trash/")).map((o) => uidOf(o.key)));
  const uids = keys
    .filter((k) => k.endsWith("/meta.json"))
    .map((k) => k.split("/")[1])
    .filter((uid) => !trashed.has(uid) && (!only || uid === only));
  log(`${uids.length} videos${dryRun ? " (dry run: nothing is written)" : ""}`);
  for (const uid of uids) await attempt("add low rungs", uid, () => addLowRungs(uid, dryRun));
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
  for (const from of ["uploads", "imports"] as const) {
    for (const { key } of await list(`${from}/`)) {
      const uid = uidOf(key);
      if (uid && !trashed.has(uid)) await attempt("encode", uid, () => encode(uid, from));
    }
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

async function main() {
  const flag = (name: string) => process.argv.includes(name);
  try {
    await preflight();
  } catch (e) {
    log(`cannot encode with ${CODEC}; is ffmpeg installed (with this encoder)?`, e);
    process.exit(1);
  }
  if (flag("--add-low-rungs")) {
    const only = flag("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;
    return addLowRungsToAll(flag("--dry-run"), only);
  }
  const once = flag("--once");
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
}

// Not when a test imports this file (import.meta.main is false there; undefined before Node 24.2).
if ((import.meta as { main?: boolean }).main !== false) await main();
