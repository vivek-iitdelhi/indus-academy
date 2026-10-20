import assert from "node:assert/strict";
import { test } from "node:test";
import { gradeQuiz } from "./quiz.ts";

const questions = [{ correct: [1] }, { correct: [0, 2] }, { correct: [3] }];

test("all right passes with 100", () => {
  assert.deepEqual(gradeQuiz(questions, [[1], [2, 0], [3]]), {
    scorePercent: 100,
    passed: true,
    perQuestion: [true, true, true],
  });
});

test("multi-select needs exactly the correct set", () => {
  const g = gradeQuiz(questions, [[1], [0], [3]]);
  assert.deepEqual(g.perQuestion, [true, false, true]);
  assert.equal(g.scorePercent, 67);
  assert.equal(g.passed, false); // below the default 70
  assert.equal(gradeQuiz(questions, [[1], [0, 1, 2], [3]]).perQuestion[1], false);
});

test("pass mark is configurable and inclusive", () => {
  assert.equal(gradeQuiz(questions, [[1], [0], [3]], 67).passed, true);
});

test("missing, duplicate and junk answers are handled", () => {
  assert.deepEqual(gradeQuiz(questions, [[1, 1]]).perQuestion, [true, false, false]);
  assert.equal(gradeQuiz(questions, "nope").scorePercent, 0);
  assert.equal(gradeQuiz(questions, [["1"], [0, 2], [3]]).scorePercent, 67);
});

test("an empty quiz passes", () => {
  assert.deepEqual(gradeQuiz([], []), { scorePercent: 100, passed: true, perQuestion: [] });
});
