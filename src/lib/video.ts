import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { KEY_FILE, KEY_URI_PLACEHOLDER } from "./hls-crypto.ts";

// The ONLY file that knows where videos live: a private Cloudflare R2 bucket, spoken to
// over the S3 API. Everything else deals in opaque video UIDs and the URLs returned here.
// Encoding runs on our own machine (scripts/encoder.ts). Bucket layout, shared with it:
//   uploads/<uid>                 the admin's upload, waiting for the encoder
//   imports/<uid>                 an https URL for the encoder to fetch and encode (live class recordings)
//   videos/<uid>/master.m3u8      HLS master; <rung>/index.m3u8 and <rung>/[e_]seg_NNNN.ts per quality
//   videos/<uid>/enc.key          AES-128 key of the (e_) segments; served only by videoKeyFor
//   videos/<uid>/thumb.jpg
//   videos/<uid>/meta.json        written last: {"durationSeconds": n}; its presence = ready
//   videos/<uid>/error.txt        the encoder could not process the upload
//   trash/<uid>                   asks the encoder to delete everything for <uid>
//   encoder/heartbeat.json        {"at": ISO time}, rewritten every minute while the encoder runs
//   form-uploads/<formId>/<uuid>/<name>   files attached to form responses (never encoded)
// Playlists are served by /api/video/<uid>/… (token-checked, segment URLs presigned);
// segments come straight from R2, whose egress is free. Segments are AES-128 encrypted; the key
// comes from /api/video/<uid>/key only with the token AND a proof header that our player pages
// hold but no URL contains, so download tools that follow the playlist get unplayable bytes.

const MAX_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const UPLOAD_URL_TTL_SECONDS = 24 * 60 * 60;
const MIN_PART_BYTES = 16 * 1024 * 1024; // R2: parts ≥ 5 MiB, all but the last the same size
const MAX_PARTS = 10_000;

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const ENV = ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "VIDEO_TOKEN_SECRET"];
export const videoConfigured = () => ENV.every((name) => Boolean(process.env[name]));

// --- S3 signing (AWS Signature V4) -----------------------------------------

export type S3Target = { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; bucket?: string };

const r2 = (): S3Target => ({
  endpoint: env("R2_ENDPOINT"), // https://<account id>.r2.cloudflarestorage.com
  region: "auto",
  accessKeyId: env("R2_ACCESS_KEY_ID"),
  secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
  bucket: env("R2_BUCKET"),
});

const ALGORITHM = "AWS4-HMAC-SHA256";
const UNSIGNED = "UNSIGNED-PAYLOAD";
// RFC 3986: encodeURIComponent leaves !'()* alone; SigV4 wants them encoded.
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/**
 * Signs one S3 request. With `expiresIn` the signature goes in the query string (a
 * presigned URL anyone can use until it expires); otherwise in headers to send along.
 * `headers` (lower-case names) are signed too; x-amz-* headers must be.
 */
export function signS3(
  target: S3Target,
  method: string,
  key: string,
  {
    query = {},
    headers = {},
    expiresIn,
    now = new Date(),
  }: { query?: Record<string, string>; headers?: Record<string, string>; expiresIn?: number; now?: Date } = {},
): { url: string; headers: Record<string, string> } {
  const { host, origin } = new URL(target.endpoint);
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, ""); // 20130524T000000Z
  const scope = `${amzDate.slice(0, 8)}/${target.region}/s3/aws4_request`;
  const path = `${target.bucket ? `/${target.bucket}` : ""}/${key.split("/").map(enc).join("/")}`;

  const q = { ...query };
  const h: Record<string, string> = { host, ...headers };
  if (expiresIn) {
    Object.assign(q, {
      "X-Amz-Algorithm": ALGORITHM,
      "X-Amz-Credential": `${target.accessKeyId}/${scope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(Math.round(expiresIn)),
      "X-Amz-SignedHeaders": Object.keys(h).sort().join(";"),
    });
  } else {
    Object.assign(h, { "x-amz-content-sha256": UNSIGNED, "x-amz-date": amzDate });
  }
  const names = Object.keys(h).sort();
  const canonicalQuery = Object.keys(q)
    .sort()
    .map((k) => `${enc(k)}=${enc(q[k])}`)
    .join("&");
  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    names.map((n) => `${n}:${h[n].trim()}\n`).join(""),
    names.join(";"),
    UNSIGNED,
  ].join("\n");
  const stringToSign = [ALGORITHM, amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  let signingKey = hmac(`AWS4${target.secretAccessKey}`, amzDate.slice(0, 8));
  for (const part of [target.region, "s3", "aws4_request"]) signingKey = hmac(signingKey, part);
  const signature = hmac(signingKey, stringToSign).toString("hex");

  const url = `${origin}${path}`;
  if (expiresIn) return { url: `${url}?${canonicalQuery}&X-Amz-Signature=${signature}`, headers: {} };
  const send = { ...h };
  delete send.host; // fetch sets it
  send.authorization = `${ALGORITHM} Credential=${target.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
  return { url: canonicalQuery ? `${url}?${canonicalQuery}` : url, headers: send };
}

/** One authenticated request to the bucket. Non-2xx responses are returned, not thrown. */
export function r2Fetch(
  method: string,
  key: string,
  { query, headers, body, timeoutMs = 15_000 }: { query?: Record<string, string>; headers?: Record<string, string>; body?: BodyInit; timeoutMs?: number } = {},
) {
  const signed = signS3(r2(), method, key, { query, headers });
  return fetch(signed.url, { method, body, headers: signed.headers, signal: AbortSignal.timeout(timeoutMs) });
}

/** A presigned URL for `key`, valid for `expiresIn` seconds (R2 allows up to 7 days). */
const presign = (method: string, key: string, expiresIn: number, query?: Record<string, string>) =>
  signS3(r2(), method, key, { query, expiresIn }).url;

async function check(res: Response, what: string) {
  const text = await res.text();
  // S3 can answer 200 with an <Error> body (e.g. CompleteMultipartUpload).
  if (!res.ok || text.includes("<Error>")) throw new Error(`R2 ${what} responded ${res.status}: ${text.slice(0, 500)}`);
  return text;
}

/** True if the object exists; throws on anything but 200/404 (e.g. bad credentials). */
async function exists(key: string) {
  const res = await r2Fetch("HEAD", key);
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`R2 HEAD ${key} responded ${res.status}`);
  return true;
}

// --- Uploads ----------------------------------------------------------------

export type UploadTicket = { uid: string; uploadId: string; partSize: number; partUrls: string[] };

/**
 * Starts a multipart upload of `size` bytes. The browser PUTs each part to its URL
 * (reading the ETag response header), then the server calls completeUpload.
 */
export async function createUpload(size: number): Promise<UploadTicket> {
  const uid = randomUUID();
  const key = `uploads/${uid}`;
  const xml = await check(await r2Fetch("POST", key, { query: { uploads: "" } }), "CreateMultipartUpload");
  const uploadId = xml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  if (!uploadId) throw new Error(`R2 CreateMultipartUpload returned no UploadId: ${xml.slice(0, 500)}`);
  const partSize = Math.max(MIN_PART_BYTES, Math.ceil(size / MAX_PARTS));
  const partUrls = Array.from({ length: Math.ceil(size / partSize) }, (_, i) =>
    presign("PUT", key, UPLOAD_URL_TTL_SECONDS, { partNumber: String(i + 1), uploadId }),
  );
  return { uid, uploadId, partSize, partUrls };
}

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Joins the uploaded parts into uploads/<uid>, which queues it for the encoder. */
export async function completeUpload(uid: string, uploadId: string, etags: string[]) {
  const parts = etags.map((etag, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${xmlEscape(etag)}</ETag></Part>`);
  const body = `<CompleteMultipartUpload>${parts.join("")}</CompleteMultipartUpload>`;
  await check(
    await r2Fetch("POST", `uploads/${uid}`, { query: { uploadId }, body, headers: { "content-type": "application/xml" }, timeoutMs: 60_000 }),
    "CompleteMultipartUpload",
  );
}

export type VideoStatus = {
  ready: boolean;
  durationSeconds: number; // 0 until ready
  state: "pendingupload" | "processing" | "ready" | "error";
};

export async function getVideoStatus(uid: string): Promise<VideoStatus> {
  const meta = await r2Fetch("GET", `videos/${uid}/meta.json`);
  if (meta.ok) {
    const { durationSeconds } = (await meta.json()) as { durationSeconds: number };
    return { ready: true, durationSeconds: Math.round(durationSeconds), state: "ready" };
  }
  if (meta.status !== 404) throw new Error(`R2 GET meta.json responded ${meta.status}`);
  if (await exists(`videos/${uid}/error.txt`)) return { ready: false, durationSeconds: 0, state: "error" };
  const queued = (await exists(`uploads/${uid}`)) || (await exists(`imports/${uid}`));
  return { ready: false, durationSeconds: 0, state: queued ? "processing" : "pendingupload" };
}

/**
 * Queues a video at an https URL (a live class recording) for the encoder, under a new uid. The
 * encoder downloads it itself, so the file never passes through the app.
 */
export async function importVideo(url: string): Promise<string> {
  const uid = randomUUID();
  await check(await r2Fetch("PUT", `imports/${uid}`, { body: url, headers: { "content-type": "text/plain" } }), "PUT import");
  return uid;
}

/** Queues the video (and any upload of it) for deletion; the encoder removes the files. */
export async function deleteVideo(uid: string): Promise<void> {
  await check(await r2Fetch("PUT", `trash/${uid}`, { body: "" }), "PUT trash");
}

/** When the encoder machine last checked in, or null if it never has. */
export async function encoderLastSeen(): Promise<Date | null> {
  const res = await r2Fetch("GET", "encoder/heartbeat.json");
  if (res.status === 404) return null;
  const { at } = JSON.parse(await check(res, "GET heartbeat")) as { at: string };
  return new Date(at);
}

/** No heartbeat for this long: treat the encoder as offline. */
export const ENCODER_OFFLINE_MS = 3 * 60_000;

// --- Playback ---------------------------------------------------------------

const tokenSignature = (uid: string, exp: number) =>
  createHmac("sha256", env("VIDEO_TOKEN_SECRET")).update(`${uid}.${exp}`).digest("base64url");

/**
 * Playback token for one video: `<exp>.<hmac>`. Mint it only after canViewLesson (+ the
 * unlock check). Segment URLs expire with it, so the TTL must outlast the viewing session.
 */
export function signPlaybackToken(uid: string, ttlSeconds = 6 * 60 * 60): string {
  const exp = Math.floor(Date.now() / 1000) + Math.min(Math.max(ttlSeconds, 60), MAX_TOKEN_TTL_SECONDS);
  return `${exp}.${tokenSignature(uid, exp)}`;
}

/** The token's expiry (unix seconds) if it is valid for `uid` and unexpired, else null. */
export function verifyPlaybackToken(uid: string, token: string): number | null {
  const [expText, signature = ""] = token.split(".");
  const exp = Number(expText);
  if (!Number.isSafeInteger(exp) || exp <= Date.now() / 1000) return null;
  const expected = Buffer.from(tokenSignature(uid, exp));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected) ? exp : null;
}

const proofSignature = (token: string) =>
  createHmac("sha256", env("VIDEO_TOKEN_SECRET")).update(`key-proof.${token}`).digest("base64url");

/**
 * What our player sends in the KEY_PROOF_HEADER to get the decryption key for `token`. Only
 * ever rendered into our own player pages, never into a URL or the partner API.
 */
export const keyProof = (token: string) => proofSignature(token);

export function verifyKeyProof(token: string, proof: string): boolean {
  const expected = Buffer.from(proofSignature(token));
  const given = Buffer.from(proof);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const KEY_PROOF_HEADER = "x-iaa-key-proof";

/** The video's AES-128 key for a valid token and proof; null if refused or missing. */
export async function videoKeyFor(uid: string, token: string, proof: string): Promise<Buffer | null> {
  if (!verifyPlaybackToken(uid, token) || !verifyKeyProof(token, proof)) return null;
  const res = await r2Fetch("GET", `videos/${uid}/${KEY_FILE}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 GET key responded ${res.status}`);
  return Buffer.from(await res.arrayBuffer()); // binary: not through check(), which reads text
}

/** HLS master playlist (same-origin path; prefix an origin for other sites). */
export const hlsManifestUrl = (uid: string, token: string) => `/api/video/${uid}/master.m3u8?t=${encodeURIComponent(token)}`;

export const thumbnailUrl = (uid: string, ttlSeconds: number) => presign("GET", `videos/${uid}/thumb.jpg`, ttlSeconds);

const PLAYLIST = /^(master|\d+\/index)\.m3u8$/;
const SAFE_REF = /^[\w.-]+(\/[\w.-]+)?$/;

/**
 * Rewrites one of our playlists for a viewer: playlist references keep the token,
 * segment references become presigned R2 URLs that expire with it.
 */
export function rewritePlaylist(
  text: string,
  { uid, file, token, sign }: { uid: string; file: string; token: string; sign: (key: string) => string },
) {
  const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "";
  const ref = (name: string) => {
    if (!SAFE_REF.test(name) || name.includes("..")) throw new Error(`Unexpected playlist entry: ${name}`);
    return name.endsWith(".m3u8") ? `${name}?t=${encodeURIComponent(token)}` : sign(`videos/${uid}/${dir}${name}`);
  };
  return text
    .split("\n")
    .map((raw) => {
      const line = raw.trim();
      if (!line) return line;
      if (line.startsWith("#EXT-X-KEY")) {
        // The key never gets a storage URL: it comes from our endpoint, with the proof header.
        return line.replace(/URI="([^"]+)"/, (_, name: string) => {
          if (name !== KEY_URI_PLACEHOLDER) throw new Error(`Unexpected key URI: ${name}`);
          return `URI="/api/video/${uid}/key?t=${encodeURIComponent(token)}"`;
        });
      }
      if (line.startsWith("#")) return line.replace(/URI="([^"]+)"/, (_, name: string) => `URI="${ref(name)}"`);
      return ref(line);
    })
    .join("\n");
}

/** The playlist `file` of video `uid` for the holder of `token`; null if refused or missing. */
export async function playlistFor(uid: string, file: string, token: string): Promise<string | null> {
  const exp = verifyPlaybackToken(uid, token);
  if (!exp || !PLAYLIST.test(file)) return null;
  const res = await r2Fetch("GET", `videos/${uid}/${file}`);
  if (res.status === 404) return null;
  const text = await check(res, `GET ${file}`);
  const expiresIn = Math.max(exp - Math.floor(Date.now() / 1000), 1);
  return rewritePlaylist(text, { uid, file, token, sign: (key) => presign("GET", key, expiresIn) });
}

// --- Form attachments ---------------------------------------------------------
// Files learners attach to form responses. Same private bucket, outside the encoder's prefixes.

const FORM_FILE_URL_TTL_SECONDS = 15 * 60;

/** A fresh storage key for a file attached to a response of form `formId`. */
export const formFileKey = (formId: string, name: string) =>
  `form-uploads/${formId}/${randomUUID()}/${name.replace(/[^\w.-]+/g, "_").slice(-100) || "file"}`;

/** True if `key` is a form attachment key of form `formId` (keys come back from the browser). */
export const isFormFileKey = (formId: string, key: unknown): key is string =>
  typeof key === "string" && new RegExp(`^form-uploads/${formId}/[0-9a-f-]{36}/[\\w.-]{1,100}$`).test(key);

/** A presigned single PUT the browser uploads the file to. */
export const formFileUploadUrl = (key: string) => presign("PUT", key, FORM_FILE_URL_TTL_SECONDS);

/** Size in bytes of an uploaded attachment, or null if it is not there. */
export async function formFileSize(key: string): Promise<number | null> {
  const res = await r2Fetch("HEAD", key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD ${key} responded ${res.status}`);
  return Number(res.headers.get("content-length") ?? 0);
}

/** A short-lived download link for an attachment (admins only). */
export const formFileDownloadUrl = (key: string, filename: string) =>
  presign("GET", key, FORM_FILE_URL_TTL_SECONDS, {
    "response-content-disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "_")}"`,
  });

/** Deletes an attachment; a missing file is not an error. */
export async function deleteFormFile(key: string): Promise<void> {
  const res = await r2Fetch("DELETE", key);
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${key} responded ${res.status}`);
}
