import assert from "node:assert/strict";
import { test } from "node:test";
import { MESSAGES, parseEmbedOptions, secondsLeft } from "./player.ts";

const parse = (query: string) => parseEmbedOptions(new URLSearchParams(query));

test("no parameters: English, from the start, every rendition (existing embed URLs)", () => {
  assert.deepEqual(parse("t=123.abc"), { lang: "en", start: 0, maxHeight: null });
});

test("lang is hi or en; anything else is English", () => {
  assert.equal(parse("lang=hi").lang, "hi");
  assert.equal(parse("lang=en").lang, "en");
  assert.equal(parse("lang=HI").lang, "en");
  assert.equal(parse("lang=fr").lang, "en");
});

test("start takes whole seconds and ignores garbage", () => {
  assert.equal(parse("start=95").start, 95);
  assert.equal(parse("start=95.9").start, 95);
  for (const bad of ["-5", "abc", "", "Infinity", "NaN", "1e9", "0"]) assert.equal(parse(`start=${bad}`).start, 0, bad);
});

test("max_height is a positive whole number of pixels or nothing", () => {
  assert.equal(parse("max_height=360").maxHeight, 360);
  for (const bad of ["0", "-144", "360.5", "abc", "", "99999"]) assert.equal(parse(`max_height=${bad}`).maxHeight, null, bad);
});

test("seconds left counts down to zero, never below", () => {
  const exp = 1_800_000_000;
  assert.equal(secondsLeft(exp, (exp - 3600) * 1000), 3600);
  assert.equal(secondsLeft(exp, (exp - 3600) * 1000 + 999), 3600);
  assert.equal(secondsLeft(exp, exp * 1000), 0);
  assert.equal(secondsLeft(exp, (exp + 60) * 1000), 0);
});

test("every message exists in every language, translated", () => {
  const keys = Object.keys(MESSAGES.en).sort();
  assert.deepEqual(Object.keys(MESSAGES.hi).sort(), keys);
  for (const key of keys) {
    const hi = MESSAGES.hi[key as keyof typeof MESSAGES.hi];
    assert.match(hi, /[ऀ-ॿ]/, `${key} has Devanagari`);
    assert.notEqual(hi, MESSAGES.en[key as keyof typeof MESSAGES.en]);
  }
  assert.doesNotMatch(MESSAGES.en.expired, /reload/i, "reloading reuses the expired link");
});
