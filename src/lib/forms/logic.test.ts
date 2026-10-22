import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptAttribute,
  answersFromQuery,
  checkResponse,
  fileAccepted,
  formatAnswer,
  nextPage,
  pages,
  pathFrom,
  prefillQuery,
  REQUIRED,
  validateAnswer,
  youTubeId,
} from "./logic.ts";
import type { FormItem, QuestionItem, TextValidation } from "./types.ts";

// Page 0: name, track (branching) · s1 (page 1): college · s2 (page 2, goTo submit after page 1): work · s3 (page 3): final
const items: FormItem[] = [
  { id: "name", type: "short", title: "Name", required: true },
  {
    id: "track",
    type: "choice",
    title: "Track",
    branching: true,
    options: [{ label: "Student", goTo: "s1" }, { label: "Working", goTo: "s2" }, { label: "Done", goTo: "submit" }, { label: "Plain" }],
    other: true,
  },
  { id: "s1", type: "section", title: "College" },
  { id: "college", type: "short", title: "College", required: true },
  { id: "s2", type: "section", title: "Work", goTo: "s3" },
  { id: "work", type: "short", title: "Company", required: true },
  { id: "s3", type: "section", title: "Final" },
  { id: "final", type: "paragraph", title: "Anything else?" },
];

test("pages split on sections; page 0 is the header page", () => {
  const p = pages(items);
  assert.equal(p.length, 4);
  assert.deepEqual(p.map((page) => page.map((i) => i.id)), [["name", "track"], ["s1", "college"], ["s2", "work"], ["s3", "final"]]);
  assert.deepEqual(pages([]), [[]]);
});

test("branching question routes by the chosen option", () => {
  assert.equal(nextPage(items, 0, { track: "Student" }), 1);
  assert.equal(nextPage(items, 0, { track: "Working" }), 2);
  assert.equal(nextPage(items, 0, { track: "Done" }), "submit");
  assert.equal(nextPage(items, 0, { track: "Plain" }), 1, "option without goTo: next page");
  assert.equal(nextPage(items, 0, { track: "my own" }), 1, "Other text: next page");
  assert.equal(nextPage(items, 0, {}), 1, "unanswered: next page");
});

test("section goTo applies to the page before it; last page submits", () => {
  // Page 1 is followed by s2 whose goTo is s3: after college, skip work.
  assert.equal(nextPage(items, 1, {}), 3);
  assert.equal(nextPage(items, 2, {}), 3);
  assert.equal(nextPage(items, 3, {}), "submit");
  const submitAfter: FormItem[] = [{ id: "a", type: "short", title: "A" }, { id: "s", type: "section", title: "S", goTo: "submit" }, { id: "b", type: "short", title: "B" }];
  assert.equal(nextPage(submitAfter, 0, {}), "submit");
  const unknown: FormItem[] = [{ id: "s", type: "section", title: "S", goTo: "gone" }];
  assert.equal(nextPage(unknown, 0, {}), 1, "unknown section: next page");
});

test("the last branching question answered on a page wins", () => {
  const two: FormItem[] = [
    { id: "a", type: "dropdown", title: "A", branching: true, options: [{ label: "x", goTo: "s2" }] },
    { id: "b", type: "choice", title: "B", branching: true, options: [{ label: "y", goTo: "s1" }] },
    { id: "s1", type: "section", title: "1" },
    { id: "s2", type: "section", title: "2" },
  ];
  assert.equal(nextPage(two, 0, { a: "x", b: "y" }), 1);
  assert.equal(nextPage(two, 0, { a: "x" }), 2);
  // Branching beats the next section's goTo.
  const both: FormItem[] = [
    { id: "a", type: "choice", title: "A", branching: true, options: [{ label: "x", goTo: "next" }] },
    { id: "s1", type: "section", title: "1", goTo: "submit" },
  ];
  assert.equal(nextPage(both, 0, { a: "x" }), 1);
  assert.equal(nextPage(both, 0, {}), "submit");
});

test("pathFrom follows branches and stops on loops", () => {
  assert.deepEqual(pathFrom(items, 0, { track: "Student" }), [0, 1, 3]);
  assert.deepEqual(pathFrom(items, 0, { track: "Working" }), [0, 2, 3]);
  assert.deepEqual(pathFrom(items, 0, { track: "Done" }), [0]);
  const loop: FormItem[] = [{ id: "s1", type: "section", title: "1", goTo: "s1" }];
  assert.deepEqual(pathFrom(loop, 0, {}), [0, 1]);
  const back: FormItem[] = [{ id: "s1", type: "section", title: "1" }, { id: "s2", type: "section", title: "2", goTo: "s1" }];
  assert.deepEqual(pathFrom(back, 0, {}), [0, 1]);
});

test("checkResponse keeps visited answers only, cleaned, and reports errors", () => {
  const r = checkResponse(items, { name: "  Asha ", track: "Student", college: "IIT", work: "Acme", final: "", stray: "x" } as never);
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.answers, { name: "Asha", track: "Student", college: "IIT" });

  const missing = checkResponse(items, { track: "Working" });
  assert.deepEqual(missing.errors, { name: REQUIRED, work: REQUIRED });

  const bad = checkResponse(items, { name: 42 } as never);
  assert.equal(bad.errors.name, "Invalid answer");
  assert.deepEqual(checkResponse(items, null as never).errors, { name: REQUIRED, college: REQUIRED });
});

const short = (validation: TextValidation, required = false): QuestionItem => ({ id: "q", type: "short", title: "Q", required, validation });

test("required and optional empties", () => {
  const q: QuestionItem = { id: "q", type: "short", title: "Q", required: true };
  assert.equal(validateAnswer(q, undefined), REQUIRED);
  assert.equal(validateAnswer(q, "   "), REQUIRED);
  assert.equal(validateAnswer({ ...q, required: false }, ""), null);
  assert.equal(validateAnswer(short({ kind: "number", op: "isNumber" }), ""), null, "validation skipped on empty optional");
});

test("number validations", () => {
  const cases: [TextValidation, string, boolean][] = [
    [{ kind: "number", op: "gt", a: 5 }, "6", true],
    [{ kind: "number", op: "gt", a: 5 }, "5", false],
    [{ kind: "number", op: "gte", a: 5 }, "5", true],
    [{ kind: "number", op: "lt", a: 5 }, "4.9", true],
    [{ kind: "number", op: "lt", a: 5 }, "5", false],
    [{ kind: "number", op: "lte", a: 5 }, "5", true],
    [{ kind: "number", op: "eq", a: 5 }, "5.0", true],
    [{ kind: "number", op: "eq", a: 5 }, "6", false],
    [{ kind: "number", op: "neq", a: 5 }, "5", false],
    [{ kind: "number", op: "between", a: 1, b: 10 }, "10", true],
    [{ kind: "number", op: "between", a: 10, b: 1 }, "0", false],
    [{ kind: "number", op: "notBetween", a: 1, b: 10 }, "5", false],
    [{ kind: "number", op: "notBetween", a: 1, b: 10 }, "11", true],
    [{ kind: "number", op: "isNumber" }, "-3.5", true],
    [{ kind: "number", op: "isNumber" }, "abc", false],
    [{ kind: "number", op: "isNumber" }, "1e3", true],
    [{ kind: "number", op: "whole" }, "3", true],
    [{ kind: "number", op: "whole" }, "3.5", false],
    [{ kind: "number", op: "gt", a: 0 }, "12abc", false],
  ];
  for (const [v, input, ok] of cases) assert.equal(validateAnswer(short(v), input) === null, ok, `${v.op} ${input}`);
  assert.equal(validateAnswer(short({ kind: "number", op: "gt", a: 5 }), "1"), "Must be a number greater than 5");
});

test("text, length and regex validations", () => {
  const cases: [TextValidation, string, boolean][] = [
    [{ kind: "text", op: "contains", value: "@college.edu" }, "a@college.edu", true],
    [{ kind: "text", op: "contains", value: "@college.edu" }, "a@gmail.com", false],
    [{ kind: "text", op: "notContains", value: "spam" }, "no spam", false],
    [{ kind: "text", op: "notContains", value: "spam" }, "fine", true],
    [{ kind: "text", op: "email" }, "a@b.co", true],
    [{ kind: "text", op: "email" }, "a@b", false],
    [{ kind: "text", op: "url" }, "https://example.com/x", true],
    [{ kind: "text", op: "url" }, "example.com", true],
    [{ kind: "text", op: "url" }, "not a url", false],
    [{ kind: "text", op: "url" }, "javascript:alert(1)", false],
    [{ kind: "length", op: "max", n: 3 }, "abc", true],
    [{ kind: "length", op: "max", n: 3 }, "abcd", false],
    [{ kind: "length", op: "min", n: 3 }, "ab", false],
    [{ kind: "regex", op: "contains", pattern: "\\d{3}" }, "ab123c", true],
    [{ kind: "regex", op: "notContains", pattern: "\\d" }, "ab1", false],
    [{ kind: "regex", op: "matches", pattern: "\\d{10}" }, "9876543210", true],
    [{ kind: "regex", op: "matches", pattern: "\\d{10}" }, "98765432101", false],
    [{ kind: "regex", op: "notMatches", pattern: "a|b" }, "a", false],
    [{ kind: "regex", op: "notMatches", pattern: "a|b" }, "ab", true],
    [{ kind: "regex", op: "matches", pattern: "(" }, "anything", true],
    [{ kind: "regex", op: "matches", pattern: "^[6-9][0-9]{9}$" }, "9876543210", true],
    [{ kind: "regex", op: "matches", pattern: "^[6-9][0-9]{9}$" }, "5876543210", false],
  ];
  for (const [v, input, ok] of cases) assert.equal(validateAnswer(short(v), input) === null, ok, `${v.kind} ${v.op} ${input}`);
  assert.equal(validateAnswer(short({ kind: "text", op: "email", message: "Use your email" }), "x"), "Use your email");
  const para: QuestionItem = { id: "p", type: "paragraph", title: "P", validation: { kind: "length", op: "min", n: 5 } };
  assert.equal(validateAnswer(para, "abc"), "Must be at least 5 characters");
  assert.equal(validateAnswer(para, "abcdef"), null);
});

test("choices, dropdowns and checkboxes", () => {
  const choice: QuestionItem = { id: "c", type: "choice", title: "C", options: [{ label: "A" }, { label: "B" }] };
  assert.equal(validateAnswer(choice, "A"), null);
  assert.equal(validateAnswer(choice, "Z"), "Choose one of the options");
  assert.equal(validateAnswer({ ...choice, other: true }, "Z"), null);
  assert.equal(validateAnswer(choice, ["A"]), "Invalid answer");
  const dropdown: QuestionItem = { id: "d", type: "dropdown", title: "D", options: [{ label: "A" }] };
  assert.equal(validateAnswer(dropdown, "A"), null);
  assert.equal(validateAnswer(dropdown, "B"), "Choose one of the options");

  const boxes: QuestionItem = { id: "b", type: "checkboxes", title: "B", options: [{ label: "A" }, { label: "B" }, { label: "C" }] };
  assert.equal(validateAnswer(boxes, ["A", "B"]), null);
  assert.equal(validateAnswer(boxes, ["A", "Z"]), "Choose from the options");
  assert.equal(validateAnswer({ ...boxes, other: true }, ["A", "Z"]), null);
  assert.equal(validateAnswer({ ...boxes, other: true }, ["Y", "Z"]), "Choose from the options");
  assert.equal(validateAnswer({ ...boxes, validation: { op: "atLeast", n: 2 } }, ["A"]), "Select at least 2 options");
  assert.equal(validateAnswer({ ...boxes, validation: { op: "atMost", n: 1 } }, ["A", "B"]), "Select at most 1 option");
  assert.equal(validateAnswer({ ...boxes, validation: { op: "exactly", n: 2 } }, ["A", "B"]), null);
  assert.equal(validateAnswer({ ...boxes, validation: { op: "exactly", n: 2, message: "Pick two" } }, ["A"]), "Pick two");
  assert.equal(validateAnswer({ ...boxes, required: true }, []), REQUIRED);
});

test("scale and rating ranges", () => {
  const scale: QuestionItem = { id: "s", type: "scale", title: "S", min: 1, max: 5 };
  assert.equal(validateAnswer(scale, 1), null);
  assert.equal(validateAnswer(scale, 0), "Invalid answer");
  assert.equal(validateAnswer(scale, 6), "Invalid answer");
  assert.equal(validateAnswer(scale, 2.5), "Invalid answer");
  assert.equal(validateAnswer(scale, "3"), "Invalid answer");
  const rating: QuestionItem = { id: "r", type: "rating", title: "R", max: 5, icon: "star" };
  assert.equal(validateAnswer(rating, 5), null);
  assert.equal(validateAnswer(rating, 0), "Invalid answer");
});

test("grids", () => {
  const grid: QuestionItem = { id: "g", type: "choiceGrid", title: "G", rows: ["r1", "r2"], columns: ["c1", "c2"] };
  assert.equal(validateAnswer(grid, { r1: "c1" }), null);
  assert.equal(validateAnswer(grid, { r3: "c1" }), "Invalid answer");
  assert.equal(validateAnswer(grid, { r1: "c3" }), "Invalid answer");
  assert.equal(validateAnswer({ ...grid, requireEachRow: true }, { r1: "c1" }), "This question requires one response per row");
  assert.equal(validateAnswer({ ...grid, required: true, requireEachRow: true }, {}), REQUIRED);
  assert.equal(validateAnswer({ ...grid, onePerColumn: true }, { r1: "c1", r2: "c1" }), "Please don't select more than one response per column");
  assert.equal(validateAnswer({ ...grid, onePerColumn: true }, { r1: "c1", r2: "c2" }), null);

  const boxes: QuestionItem = { ...grid, type: "checkboxGrid" };
  assert.equal(validateAnswer(boxes, { r1: ["c1", "c2"] }), null);
  assert.equal(validateAnswer(boxes, { r1: "c1" }), "Invalid answer");
  assert.equal(validateAnswer(boxes, { r1: ["c1", "c1"] }), "Invalid answer");
  assert.equal(validateAnswer({ ...boxes, onePerColumn: true }, { r1: ["c1"], r2: ["c1"] }), "Please don't select more than one response per column");
  assert.equal(validateAnswer({ ...boxes, required: true }, { r1: [] }), REQUIRED);
});

test("dates and times", () => {
  const date = (includeYear: boolean, includeTime: boolean): QuestionItem => ({ id: "d", type: "date", title: "D", includeYear, includeTime });
  assert.equal(validateAnswer(date(true, false), "2026-02-28"), null);
  assert.equal(validateAnswer(date(true, false), "2026-02-29"), "Invalid date");
  assert.equal(validateAnswer(date(true, false), "2024-02-29"), null);
  assert.equal(validateAnswer(date(true, false), "2026-13-01"), "Invalid date");
  assert.equal(validateAnswer(date(false, false), "02-29"), null);
  assert.equal(validateAnswer(date(false, false), "04-31"), "Invalid date");
  assert.equal(validateAnswer(date(false, false), "2026-04-01"), "Invalid date");
  assert.equal(validateAnswer(date(true, true), "2026-04-01T09:30"), null);
  assert.equal(validateAnswer(date(true, true), "2026-04-01"), "Invalid time");
  assert.equal(validateAnswer(date(true, true), "2026-04-01T24:00"), "Invalid time");
  assert.equal(validateAnswer(date(false, true), "04-01T23:59"), null);
  assert.equal(validateAnswer(date(true, false), "2026-04-01T09:30"), "Invalid date");

  const time: QuestionItem = { id: "t", type: "time", title: "T", duration: false };
  assert.equal(validateAnswer(time, "23:59"), null);
  assert.equal(validateAnswer(time, "24:00"), "Invalid time");
  assert.equal(validateAnswer(time, "9:00"), "Invalid time");
  const duration: QuestionItem = { id: "t", type: "time", title: "T", duration: true };
  assert.equal(validateAnswer(duration, "72:30:00"), null);
  assert.equal(validateAnswer(duration, "01:60:00"), "Invalid duration");
});

test("file answers: count, size, kind and shape", () => {
  const item: QuestionItem = { id: "f", type: "file", title: "F", maxFiles: 1, maxSizeMb: 1, accept: ["pdf", "image"] };
  const file = (name: string, size = 100) => ({ key: "k", name, size, type: "" });
  assert.equal(validateAnswer(item, [file("a.pdf")]), null);
  assert.equal(validateAnswer(item, [file("a.pdf"), file("b.pdf")]), "Upload at most 1 file");
  assert.equal(validateAnswer(item, [file("a.pdf", 2 * 1024 * 1024)]), "a.pdf is larger than 1 MB");
  assert.equal(validateAnswer(item, [file("a.exe")]), "a.exe is not an allowed file type");
  assert.equal(validateAnswer(item, [{ name: "a.pdf" }]), "Invalid answer");
  assert.equal(validateAnswer({ ...item, required: true }, []), REQUIRED);
  assert.ok(fileAccepted(["image"], "Photo.JPG"));
  assert.ok(!fileAccepted(["image"], "photo"));
  assert.match(acceptAttribute(["pdf"])!, /^\.pdf$/);
  assert.equal(acceptAttribute([]), undefined);
});

test("pre-fill query round-trips", () => {
  const form: FormItem[] = [
    { id: "a", type: "short", title: "A" },
    { id: "b", type: "checkboxes", title: "B", options: [{ label: "x" }, { label: "y z" }] },
    { id: "c", type: "scale", title: "C", min: 1, max: 5 },
    { id: "g", type: "choiceGrid", title: "G", rows: ["r 1", "r2"], columns: ["c1", "c2"] },
    { id: "h", type: "checkboxGrid", title: "H", rows: ["r1"], columns: ["c1", "c2"] },
    { id: "f", type: "file", title: "F", maxFiles: 1, maxSizeMb: 1 },
  ];
  const answers = { a: "hello & bye", b: ["x", "y z"], c: 4, g: { "r 1": "c2" }, h: { r1: ["c1", "c2"] } };
  const query = prefillQuery(form, { ...answers, f: [{ key: "k", name: "n", size: 1, type: "" }] });
  const parsed: Record<string, string | string[]> = {};
  for (const [k, v] of new URLSearchParams(query)) parsed[k] = k in parsed ? [...[parsed[k]].flat(), v] : v;
  assert.deepEqual(answersFromQuery(form, parsed), answers);
  assert.deepEqual(answersFromQuery(form, { "entry.c": "x" }), {});
});

test("YouTube links", () => {
  assert.equal(youTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1"), "dQw4w9WgXcQ");
  assert.equal(youTubeId("https://youtu.be/dQw4w9WgXcQ?si=x"), "dQw4w9WgXcQ");
  assert.equal(youTubeId("https://youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youTubeId("https://m.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youTubeId("https://vimeo.com/123"), null);
  assert.equal(youTubeId("nonsense"), null);
});

test("formatAnswer", () => {
  const grid: QuestionItem = { id: "g", type: "choiceGrid", title: "G", rows: ["r1", "r2"], columns: ["c1"] };
  assert.equal(formatAnswer(grid, { r2: "c1", r1: "c1" }), "r1: c1\nr2: c1");
  assert.equal(formatAnswer({ id: "r", type: "rating", title: "R", max: 5, icon: "star" }, 4), "4 / 5");
  assert.equal(formatAnswer({ id: "b", type: "checkboxes", title: "B", options: [] }, ["a", "b"]), "a, b");
  assert.equal(formatAnswer({ id: "d", type: "date", title: "D", includeYear: true, includeTime: true }, "2026-01-02T10:00"), "2026-01-02 10:00");
});
