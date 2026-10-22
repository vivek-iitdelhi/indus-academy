import assert from "node:assert/strict";
import { test } from "node:test";
import { formTemplates } from "../forms/templates.ts";
import { changeType, formFileKeys, normalizeItems, parseSettings, removeItem, youtubeId } from "./forms.ts";

const ok = (raw: unknown) => {
  const out = normalizeItems(raw);
  assert.ok(Array.isArray(out), JSON.stringify(out));
  return out;
};
const err = (raw: unknown) => {
  const out = normalizeItems(raw);
  assert.ok(!Array.isArray(out), "expected an error");
  return out;
};

test("templates are already normal", () => {
  for (const { build } of Object.values(formTemplates)) {
    const { items } = build();
    assert.deepEqual(ok(items), items);
  }
});

test("drops unknown keys, trims, clamps and fills defaults", () => {
  const [short, scale, rating, file, choice] = ok([
    { id: "a", type: "short", title: "  Name ", description: "  ", required: true, evil: "<script>" },
    { id: "b", type: "scale", title: "", min: 5, max: 99, minLabel: " low " },
    { id: "c", type: "rating", max: 1, icon: "skull" },
    { id: "d", type: "file", maxFiles: 3, maxSizeMb: 100, accept: ["pdf", "exe", "pdf", "image"] },
    { id: "e", type: "choice", options: [{ label: " A ", goTo: "submit" }, ""], other: "yes", required: false },
  ]);
  assert.deepEqual(short, { id: "a", type: "short", title: "Name", required: true });
  assert.deepEqual(scale, { id: "b", type: "scale", title: "", min: 1, max: 10, minLabel: "low" });
  assert.deepEqual(rating, { id: "c", type: "rating", title: "", max: 3, icon: "star" });
  assert.deepEqual(file, { id: "d", type: "file", title: "", maxFiles: 1, maxSizeMb: 100, accept: ["pdf", "image"] });
  // goTo is kept only with branching on; blank labels get a name.
  assert.deepEqual(choice, { id: "e", type: "choice", title: "", options: [{ label: "A" }, { label: "Option 2" }] });
});

test("ids must be present, valid and unique", () => {
  assert.equal(err([{ type: "short" }]).index, 0);
  assert.equal(err([{ id: "a b", type: "short" }]).index, 0);
  assert.equal(err([{ id: "a", type: "short" }, { id: "a", type: "text" }]).index, 1);
  assert.equal(err([{ id: "a", type: "nope" }]).index, 0);
  assert.match(err({}).error, /list/);
});

test("option types need options, without duplicates", () => {
  err([{ id: "a", type: "choice", options: [] }]);
  err([{ id: "a", type: "dropdown" }]);
  assert.match(err([{ id: "a", type: "checkboxes", options: ["X", { label: "X" }] }]).error, /twice/);
  err([{ id: "a", type: "choiceGrid", rows: ["r"], columns: [] }]);
});

test("goTo: next, submit or an existing section", () => {
  const items = ok([
    { id: "q", type: "choice", branching: true, options: [{ label: "Yes", goTo: "s2" }, { label: "No", goTo: "submit" }, { label: "Maybe", goTo: "next" }] },
    { id: "s1", type: "section", goTo: "next" },
    { id: "s2", type: "section", goTo: "submit" },
  ]);
  assert.deepEqual(items[0], {
    id: "q",
    type: "choice",
    title: "",
    branching: true,
    options: [{ label: "Yes", goTo: "s2" }, { label: "No", goTo: "submit" }, { label: "Maybe" }],
  });
  assert.deepEqual(items[1], { id: "s1", type: "section", title: "" });
  assert.equal(err([{ id: "q", type: "dropdown", branching: true, options: [{ label: "A", goTo: "gone" }] }]).index, 0);
  err([{ id: "s", type: "section", goTo: "q" }, { id: "q", type: "short" }]);
});

test("response validation", () => {
  const [between, email, regex] = ok([
    { id: "a", type: "short", validation: { kind: "number", op: "between", a: 10, b: 1, message: " Out of range " } },
    { id: "b", type: "short", validation: { kind: "text", op: "email", value: "ignored" } },
    { id: "c", type: "paragraph", validation: { kind: "regex", op: "matches", pattern: "^\\d+$" } },
  ]);
  assert.deepEqual((between as { validation: unknown }).validation, { kind: "number", op: "between", a: 1, b: 10, message: "Out of range" });
  assert.deepEqual((email as { validation: unknown }).validation, { kind: "text", op: "email" });
  assert.deepEqual((regex as { validation: unknown }).validation, { kind: "regex", op: "matches", pattern: "^\\d+$" });

  err([{ id: "a", type: "short", validation: { kind: "number", op: "gt" } }]);
  err([{ id: "a", type: "short", validation: { kind: "number", op: "between", a: 1 } }]);
  err([{ id: "a", type: "short", validation: { kind: "text", op: "contains", value: " " } }]);
  assert.match(err([{ id: "a", type: "short", validation: { kind: "regex", op: "matches", pattern: "(" } }]).error, /not valid/);
  // Paragraphs take only length or regex.
  err([{ id: "a", type: "paragraph", validation: { kind: "number", op: "gt", a: 1 } }]);

  const [boxes] = ok([{ id: "a", type: "checkboxes", options: ["x", "y"], validation: { op: "atMost", n: 9 } }]);
  assert.deepEqual((boxes as { validation: unknown }).validation, { op: "atMost", n: 2 });
});

test("image and video need real links", () => {
  err([{ id: "a", type: "image", url: "" }]);
  err([{ id: "a", type: "image", url: "javascript:alert(1)" }]);
  ok([{ id: "a", type: "image", url: "https://example.com/a.png", alt: " A cat " }]);
  err([{ id: "a", type: "video", url: "https://vimeo.com/1" }]);
  ok([{ id: "a", type: "video", url: "https://youtu.be/dQw4w9WgXcQ" }]);
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://evil.com/watch?v=dQw4w9WgXcQ"), null);
});

test("changeType keeps the shared fields; removeItem clears branches to it", () => {
  const choice = { id: "a", type: "choice" as const, title: "T", required: true, other: true, options: [{ label: "X", goTo: "s" }] };
  assert.deepEqual(changeType(choice, "checkboxes"), { id: "a", type: "checkboxes", title: "T", required: true, other: true, options: [{ label: "X" }] });
  assert.deepEqual(changeType(choice, "dropdown"), { id: "a", type: "dropdown", title: "T", required: true, options: [{ label: "X" }] });
  assert.deepEqual(changeType(choice, "short"), { id: "a", type: "short", title: "T", required: true });

  const items = removeItem([{ ...choice, branching: true }, { id: "s", type: "section", title: "" }, { id: "t", type: "section", title: "", goTo: "s" }], "s");
  assert.deepEqual(ok(items).map((i) => i.id), ["a", "t"]);
});

test("settings", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ collectEmail: "none", sendCopy: "off", color: "#0F5D4A", ...fields })) f.set(k, v);
    return f;
  };
  const parsed = parseSettings(form({ limitOne: "on", notifyEmails: "A@x.com, b@y.in;a@x.com", confirmation: "  " }));
  assert.ok("settings" in parsed);
  assert.equal(parsed.settings.limitOne, true);
  assert.equal(parsed.settings.allowEdit, false);
  assert.deepEqual(parsed.settings.notifyEmails, ["a@x.com", "b@y.in"]);
  assert.equal(parsed.settings.confirmation, "Your response has been recorded.");
  assert.deepEqual(parsed.settings.theme, { color: "#0f5d4a" });

  assert.ok("error" in parseSettings(form({ sendCopy: "always" })));
  assert.ok("error" in parseSettings(form({ notifyEmails: "nope" })));
  assert.ok("error" in parseSettings(form({ color: "red" })));
  assert.ok("error" in parseSettings(form({ collectEmail: "all" })));
  assert.ok("error" in parseSettings(form({ headerImage: "ftp://x" })));
});

test("formFileKeys finds uploads only", () => {
  assert.deepEqual(
    formFileKeys({ a: "text", b: ["x", "y"], c: [{ key: "form-uploads/f/1/a.pdf", name: "a.pdf", size: 1, type: "" }], d: 3, e: { r: "c" } }),
    ["form-uploads/f/1/a.pdf"],
  );
});
