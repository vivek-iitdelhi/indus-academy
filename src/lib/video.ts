import { createPrivateKey, sign, type KeyObject } from "node:crypto";

// The ONLY file that knows the video provider is Cloudflare Stream. Everything else
// deals in opaque video UIDs and the URLs these functions return.

const API = "https://api.cloudflare.com/client/v4";
const MAX_TOKEN_TTL_SECONDS = 24 * 60 * 60; // Stream rejects tokens valid for longer

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const videoConfigured = () =>
  [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_STREAM_API_TOKEN",
    "CLOUDFLARE_STREAM_CUSTOMER_CODE",
    "CLOUDFLARE_STREAM_SIGNING_KEY_ID",
    "CLOUDFLARE_STREAM_SIGNING_KEY_PEM",
  ].every((name) => Boolean(process.env[name]));

const accountUrl = (path: string) => `${API}/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/stream${path}`;
const authHeader = () => ({ authorization: `Bearer ${env("CLOUDFLARE_STREAM_API_TOKEN")}` });

async function stream<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(accountUrl(path), {
    ...init,
    headers: { ...authHeader(), "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Stream ${path} responded ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { result: T }).result;
}

export type UploadTicket = { uploadUrl: string; uid: string };

/**
 * One-time URL the browser POSTs the file to (multipart/form-data, field "file").
 * Basic uploads are capped at 200 MB; use createTusUpload for anything larger.
 */
export async function createDirectUpload({
  maxDurationSeconds,
  name,
}: {
  maxDurationSeconds: number;
  name: string;
}): Promise<UploadTicket> {
  const result = await stream<{ uploadURL: string; uid: string }>("/direct_upload", {
    method: "POST",
    body: JSON.stringify({ maxDurationSeconds, requireSignedURLs: true, meta: { name } }),
  });
  return { uploadUrl: result.uploadURL, uid: result.uid };
}

const b64 = (value: string) => Buffer.from(value).toString("base64");

/**
 * Resumable (tus) upload for large files. Intended to back an admin route that is the
 * `endpoint` of tus-js-client: that route receives the client's creation POST, calls
 * this with its Upload-Length, and answers 201 with `Location: uploadUrl` (expose the
 * Location header). tus-js-client then sends the chunks straight to Cloudflare
 * (chunkSize: a multiple of 256 KiB, at least 5 MiB, ideally 50 MiB).
 */
export async function createTusUpload({
  uploadLength,
  maxDurationSeconds,
  name,
  creator,
}: {
  uploadLength: number;
  maxDurationSeconds: number;
  name: string;
  creator?: string;
}): Promise<UploadTicket> {
  const res = await fetch(accountUrl("?direct_user=true"), {
    method: "POST",
    headers: {
      ...authHeader(),
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(uploadLength),
      // key base64(value) pairs; a bare key is a boolean flag.
      "Upload-Metadata": `maxDurationSeconds ${b64(String(maxDurationSeconds))},requiresignedurls,name ${b64(name)}`,
      ...(creator && { "Upload-Creator": creator.slice(0, 64) }),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const uploadUrl = res.headers.get("location");
  const uid = res.headers.get("stream-media-id");
  if (!res.ok || !uploadUrl || !uid) {
    throw new Error(`Stream tus upload responded ${res.status}: ${await res.text()}`);
  }
  return { uploadUrl, uid };
}

export type VideoStatus = {
  ready: boolean;
  durationSeconds: number; // 0 until known
  /** Unsigned; for display use thumbnailUrl(signPlaybackToken(uid)). */
  thumbnailUrl: string | null;
  state: string; // e.g. pendingupload, queued, inprogress, ready, error
};

export async function getVideoStatus(uid: string): Promise<VideoStatus> {
  const video = await stream<{
    readyToStream: boolean;
    duration: number;
    thumbnail?: string;
    status?: { state?: string };
  }>(`/${encodeURIComponent(uid)}`);
  return {
    ready: video.readyToStream,
    durationSeconds: video.duration > 0 ? Math.round(video.duration) : 0,
    thumbnailUrl: video.thumbnail ?? null,
    state: video.status?.state ?? "unknown",
  };
}

export async function deleteVideo(uid: string): Promise<void> {
  const res = await fetch(accountUrl(`/${encodeURIComponent(uid)}`), {
    method: "DELETE",
    headers: authHeader(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Stream delete responded ${res.status}`);
}

let signingKey: { raw: string; key: KeyObject } | undefined;

/** The env var holds the base64 `pem` (or `jwk`) exactly as Stream's /stream/keys returns it. */
function privateKey(): KeyObject {
  const raw = env("CLOUDFLARE_STREAM_SIGNING_KEY_PEM");
  if (signingKey?.raw === raw) return signingKey.key;
  const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
  const key = decoded.startsWith("{")
    ? createPrivateKey({ key: JSON.parse(decoded), format: "jwk" })
    : createPrivateKey(decoded);
  signingKey = { raw, key };
  return key;
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/**
 * Self-signed RS256 playback token for a video that requires signed URLs. Mint it only
 * after hasAccess/canViewLesson. The TTL must outlast the viewing session, because HLS
 * segments are fetched with the same token; Stream caps it at 24 h.
 */
export function signPlaybackToken(uid: string, ttlSeconds = 6 * 60 * 60): string {
  const kid = env("CLOUDFLARE_STREAM_SIGNING_KEY_ID");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", kid };
  const payload = {
    sub: uid,
    kid,
    nbf: now - 60, // tolerate clock skew
    exp: now + Math.min(Math.max(ttlSeconds, 60), MAX_TOKEN_TTL_SECONDS),
  };
  const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  return `${input}.${base64url(sign("sha256", Buffer.from(input), privateKey()))}`;
}

const deliveryUrl = (token: string, path: string) =>
  `https://customer-${env("CLOUDFLARE_STREAM_CUSTOMER_CODE")}.cloudflarestream.com/${token}${path}`;

/** HLS with adaptive bitrate, for hls.js / native Safari playback. */
export const hlsManifestUrl = (token: string) => deliveryUrl(token, "/manifest/video.m3u8");
/** Stream's hosted player, for an <iframe>. */
export const iframeUrl = (token: string) => deliveryUrl(token, "/iframe");
export const thumbnailUrl = (token: string) => deliveryUrl(token, "/thumbnails/thumbnail.jpg");
