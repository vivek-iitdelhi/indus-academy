import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { generateApiKey, hashApiKey, parseBearer } from "./distributors.ts";

test("generates a random iaa_live_ key with a display prefix and its SHA-256", () => {
  const a = generateApiKey();
  const b = generateApiKey();
  assert.match(a.key, /^iaa_live_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.key, b.key);
  assert.equal(a.prefix, a.key.slice(0, 13));
  assert.equal(a.hash, createHash("sha256").update(a.key).digest("hex"));
  assert.equal(hashApiKey(a.key), a.hash);
  assert.ok(!a.hash.includes(a.key));
});

test("parses only a well-formed Bearer key", () => {
  const { key } = generateApiKey();
  assert.equal(parseBearer(`Bearer ${key}`), key);
  assert.equal(parseBearer(`bearer ${key}`), key);
  assert.equal(parseBearer(null), null);
  assert.equal(parseBearer(""), null);
  assert.equal(parseBearer(key), null);
  assert.equal(parseBearer(`Basic ${key}`), null);
  assert.equal(parseBearer(`Bearer ${key}x`), null);
  assert.equal(parseBearer(`Bearer ${key} extra`), null);
  assert.equal(parseBearer("Bearer iaa_live_short"), null);
});
