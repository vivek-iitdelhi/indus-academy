import assert from "node:assert/strict";
import { test } from "node:test";
import { financialYear, formatInvoiceNumber, isGstin, splitGst, withGstPaise } from "./gst.ts";

test("seat prices get 18% on top, and split back to the list price", () => {
  const total = withGstPaise(19999);
  assert.equal(total, 2359882);
  assert.equal(splitGst(total).taxablePaise, 1999900);
});

test("consumers and UP businesses pay CGST + SGST; other states pay IGST", () => {
  const local = splitGst(2359882);
  assert.deepEqual([local.cgstPaise, local.sgstPaise, local.igstPaise, local.placeOfSupply], [179991, 179991, 0, "09"]);
  assert.equal(splitGst(2359882, "09AAACI1234A1Z5").igstPaise, 0);
  const delhi = splitGst(2359882, "07AAACI1234A1Z5");
  assert.deepEqual([delhi.cgstPaise, delhi.sgstPaise, delhi.igstPaise, delhi.placeOfSupply], [0, 0, 359982, "07"]);
  // Odd tax amounts still add up to the total.
  const odd = splitGst(149900);
  assert.equal(odd.taxablePaise + odd.cgstPaise + odd.sgstPaise, 149900);
});

test("GSTIN shape", () => {
  assert.ok(isGstin("09AAACI1234A1Z5"));
  for (const bad of ["", "09AAACI1234A1Z", "09aaaci1234a1z5", "99AAACI1234A1Z5", "09AAACI1234A1X5"]) assert.ok(!isGstin(bad), bad);
});

test("invoice numbers run per financial year, India time", () => {
  assert.equal(financialYear(new Date("2026-03-31T18:29:00Z")), "25-26"); // 23:59 IST, 31 March
  assert.equal(financialYear(new Date("2026-03-31T18:31:00Z")), "26-27"); // 00:01 IST, 1 April
  assert.equal(formatInvoiceNumber("26-27", 7), "IAA/26-27/0007");
});
