import assert from "node:assert/strict";
import { test } from "node:test";
import { answerText, csvCell, responseFiles, responsesCsv } from "./export.ts";
import type { FormItem, QuestionItem } from "./types.ts";

const items: FormItem[] = [
  { id: "s", type: "section", title: "About you" },
  { id: "name", type: "short", title: "Name" },
  { id: "pick", type: "choice", title: "Course", options: [{ label: "A" }, { label: "B" }], other: true },
  { id: "boxes", type: "checkboxes", title: "Days", options: [{ label: "Mon" }, { label: "Tue" }] },
  { id: "grid", type: "checkboxGrid", title: "Slots", rows: ["Mon", "Tue"], columns: ["AM", "PM"] },
  { id: "when", type: "date", title: "Start", includeYear: true, includeTime: true },
  { id: "files", type: "file", title: "ID proof", maxFiles: 5, maxSizeMb: 10 },
  { id: "stars", type: "rating", title: "Rate", max: 5, icon: "star" },
];
const q = (id: string) => items.find((i) => i.id === id) as QuestionItem;
const file = (name: string) => ({ key: `form-uploads/f/${name}`, name, size: 1, type: "image/png" });

test("answerText reads every answer shape", () => {
  assert.equal(answerText(q("name"), undefined), "");
  assert.equal(answerText(q("pick"), "B"), "B");
  assert.equal(answerText(q("boxes"), ["Mon", "Tue"]), "Mon, Tue");
  assert.equal(answerText(q("grid"), { Tue: ["PM"], Mon: ["AM", "PM"], Old: ["AM"] }), "Mon: AM, PM; Tue: PM; Old: AM");
  assert.equal(answerText(q("when"), "2026-10-22T09:30"), "2026-10-22 09:30");
  assert.equal(answerText(q("files"), [file("a.png"), file("b.png")]), "a.png, b.png");
  assert.equal(answerText(q("stars"), 4), "4");
});

test("csvCell quotes and defuses formulas", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"');
  assert.equal(csvCell("two\nlines"), '"two\nlines"');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("-1+2,3"), `"'-1+2,3"`);
  assert.equal(csvCell("@x"), "'@x");
});

test("responsesCsv: one column per question, grid rows split, deleted questions skipped", () => {
  const csv = responsesCsv({ items }, [
    { createdAt: new Date("2026-10-22T04:00:00Z"), email: null, answers: { name: "Asha", grid: { Mon: ["AM"] }, gone: "x" } },
    { createdAt: new Date("2026-10-22T05:00:05Z"), email: "b@x.com", answers: { pick: "Something, else", files: [file("id.png")] } },
  ]);
  assert.deepEqual(csv.split("\r\n"), [
    "Timestamp,Email Address,Name,Course,Days,Slots [Mon],Slots [Tue],Start,ID proof,Rate",
    "2026-10-22 09:30:00,,Asha,,,AM,,,,",
    '2026-10-22 10:30:05,b@x.com,,"Something, else",,,,,id.png,',
    "",
  ]);
  assert.ok(!responsesCsv({ items }, [{ createdAt: new Date(), email: null, answers: {} }]).includes("Email Address"));
});

test("responseFiles finds files in any answer", () => {
  assert.deepEqual(
    responseFiles({ name: "x", files: [file("a.png")], boxes: ["Mon"], grid: { Mon: ["AM"] } }).map((f) => f.name),
    ["a.png"],
  );
});
