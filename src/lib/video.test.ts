import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { test } from "node:test";
import { hlsManifestUrl, signPlaybackToken } from "./video.ts";

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

function check(token: string, publicKey: ReturnType<typeof createPublicKey>) {
  const [h, p, s] = token.split(".");
  assert.ok(verify("sha256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, "base64url")), "RS256 signature");
  return { header: decode(h), payload: decode(p) };
}

test("signs an RS256 token Stream accepts, from a base64 PEM", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = "key123";
  process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM = Buffer.from(
    privateKey.export({ type: "pkcs1", format: "pem" }),
  ).toString("base64");

  const now = Math.floor(Date.now() / 1000);
  const { header, payload } = check(signPlaybackToken("video-uid", 3600), publicKey);
  assert.deepEqual(header, { alg: "RS256", kid: "key123" });
  assert.equal(payload.sub, "video-uid");
  assert.equal(payload.kid, "key123");
  assert.ok(Math.abs(payload.exp - (now + 3600)) <= 2);
  assert.ok(payload.nbf <= now);

  // TTL is capped at Stream's 24 h maximum.
  const long = check(signPlaybackToken("video-uid", 7 * 24 * 3600), publicKey).payload;
  assert.ok(long.exp - now <= 24 * 3600 + 2);
});

test("also accepts the base64 JWK form", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM = Buffer.from(
    JSON.stringify(privateKey.export({ format: "jwk" })),
  ).toString("base64");
  check(signPlaybackToken("other-uid"), publicKey);
});

test("delivery URLs put the token where the UID would be", () => {
  process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE = "abc";
  assert.equal(hlsManifestUrl("TOKEN"), "https://customer-abc.cloudflarestream.com/TOKEN/manifest/video.m3u8");
});
