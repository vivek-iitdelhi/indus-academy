import assert from "node:assert/strict";
import { test } from "node:test";
import { move, outlinePositions, parseQuestion, publishProblems, uniqueSlug } from "./courses.ts";

const outline = [
  { id: "c1", lessons: [{ id: "a" }, { id: "b" }] },
  { id: "c2", lessons: [] },
  { id: "c3", lessons: [{ id: "c" }] },
];

test("lesson positions run course-wide in chapter order, then in-chapter order", () => {
  assert.deepEqual(outlinePositions(outline), {
    chapters: [
      { id: "c1", position: 1 },
      { id: "c2", position: 2 },
      { id: "c3", position: 3 },
    ],
    lessons: [
      { id: "a", chapterId: "c1", position: 1 },
      { id: "b", chapterId: "c1", position: 2 },
      { id: "c", chapterId: "c3", position: 3 },
    ],
  });
});

test("moving a chapter carries its lessons with it", () => {
  const { lessons } = outlinePositions(move(outline, 2, -2));
  assert.deepEqual(
    lessons.map((l) => [l.id, l.position]),
    [["c", 1], ["a", 2], ["b", 3]],
  );
});

test("move swaps neighbours, clamps at the ends and does not mutate", () => {
  const items = ["a", "b", "c"];
  assert.deepEqual(move(items, 0, 1), ["b", "a", "c"]);
  assert.deepEqual(move(items, 2, 1), ["a", "b", "c"]);
  assert.deepEqual(move(items, 0, -1), ["a", "b", "c"]);
  assert.deepEqual(items, ["a", "b", "c"]);
});

test("uniqueSlug picks the first free suffix", () => {
  assert.equal(uniqueSlug("intro", ["intro", "intro-2"]), "intro-3");
  assert.equal(uniqueSlug("", []), "lesson");
});

test("parseQuestion drops blank options and re-maps correct answers", () => {
  assert.deepEqual(parseQuestion({ prompt: " Q? ", options: ["A", "", "C", " "], correct: [2], explanation: "" }), {
    question: { prompt: "Q?", options: ["A", "C"], correct: [1], explanation: null },
  });
  assert.ok("error" in parseQuestion({ prompt: "Q", options: ["A", ""], correct: [0], explanation: "" }));
  assert.ok("error" in parseQuestion({ prompt: "Q", options: ["A", "B"], correct: [], explanation: "" }));
  assert.ok("error" in parseQuestion({ prompt: "Q", options: ["A", "B"], correct: [3], explanation: "" }));
  assert.ok("error" in parseQuestion({ prompt: "", options: ["A", "B"], correct: [0], explanation: "" }));
});

test("publishProblems lists every blocker", () => {
  const video = { id: "v", title: "V", kind: "video" as const, videoUid: "uid", durationSeconds: 60 };
  const quiz = { id: "q", title: "Q", kind: "quiz" as const, videoUid: null, durationSeconds: 0 };
  assert.deepEqual(publishProblems([], []), ["Add at least one lesson."]);
  assert.deepEqual(publishProblems([video, quiz], [{ lessonId: "q", options: ["a", "b"], correct: [0] }]), []);
  assert.equal(publishProblems([{ ...video, videoUid: null }, { ...video, durationSeconds: 0 }, quiz], []).length, 3);
  assert.equal(publishProblems([quiz], [{ lessonId: "q", options: ["a"], correct: [0] }]).length, 1);
  // A replacement still processing doesn't count: only the live video does.
  const replacing = { ...video, videoUid: null, durationSeconds: 0, pendingVideoUid: "new" };
  assert.equal(publishProblems([replacing], []).length, 1);
});
