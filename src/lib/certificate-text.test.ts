import assert from "node:assert/strict";
import { test } from "node:test";
import { indicFont, latinEms, NAME_BOX, nameFontSize } from "./certificate-text.ts";

test("a name gets the Noto font for its Indic script, and none when it has none", () => {
  assert.equal(indicFont("सुनीता देवी"), "Noto Serif Devanagari");
  assert.equal(indicFont("Ravi Kumar रवि कुमार"), "Noto Serif Devanagari");
  assert.equal(indicFont("முருகன்"), "Noto Serif Tamil");
  assert.equal(indicFont("ସୁନୀତା"), "Noto Serif Oriya");
  assert.equal(indicFont("ਹਰਪ੍ਰੀਤ"), "Noto Serif Gurmukhi");
  assert.equal(indicFont("Asha Verma"), null);
  assert.equal(indicFont("José Müller"), null);
});

test("short names set at the maximum, longer ones shrink on one line down to the floor", () => {
  assert.deepEqual(nameFontSize(latinEms("Asha Verma")), { fontSize: 124, lines: 1 });
  const medium = nameFontSize(latinEms("Aishwarya Ramachandran Iyer"));
  assert.equal(medium.lines, 1);
  assert.ok(medium.fontSize < 124 && medium.fontSize >= 72);
  assert.ok(latinEms("Aishwarya Ramachandran Iyer") * medium.fontSize <= NAME_BOX);
});

test("past the floor a name wraps to two lines, shrinking below the floor only when it must", () => {
  assert.deepEqual(nameFontSize(NAME_BOX / 71), { fontSize: 72, lines: 2 });
  const long = nameFontSize(latinEms("Venkata Subramanya ".repeat(7).slice(0, 120)));
  assert.equal(long.lines, 2);
  assert.ok(long.fontSize < 72 && long.fontSize > 30);
});

test("capitals count wider than lower case", () => {
  assert.ok(latinEms("RAMESH KUMAR") > latinEms("Ramesh Kumar"));
});
