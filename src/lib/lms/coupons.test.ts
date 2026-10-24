import assert from "node:assert/strict";
import { test } from "node:test";
import { discountedPaise, normalizeCode } from "./coupons.ts";

test("normalizeCode trims, uppercases and rejects odd input", () => {
  assert.equal(normalizeCode("  diwali20 "), "DIWALI20");
  assert.equal(normalizeCode("early-bird_1"), "EARLY-BIRD_1");
  assert.equal(normalizeCode("ab"), null);
  assert.equal(normalizeCode("has space"), null);
  assert.equal(normalizeCode(undefined), null);
});

test("discountedPaise rounds to the paisa and floors tiny orders to free", () => {
  assert.equal(discountedPaise(199900, 20), 159920);
  assert.equal(discountedPaise(199900, 33), 133933);
  assert.equal(discountedPaise(199900, 100), 0);
  assert.equal(discountedPaise(5000, 99), 0); // ₹0.50 is below Cashfree's ₹1 minimum
  assert.equal(discountedPaise(10000, 0), 10000);
});
