"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CompletionNotice } from "./completion-notice";

/** What the client may know about a question: never the correct options. */
export type QuizQuestionView = { prompt: string; options: string[]; multi: boolean };

type Result = {
  scorePercent: number;
  passed: boolean;
  passPercent: number;
  perQuestion: boolean[];
  explanations: (string | null)[] | null;
  newlyCompleted: boolean;
  certificate: unknown;
};

export function Quiz({
  lessonId,
  questions,
  passPercent,
  completed,
  nextHref,
}: {
  lessonId: string;
  questions: QuizQuestionView[];
  passPercent: number;
  completed: boolean;
  nextHref: string | null;
}) {
  const [answers, setAnswers] = useState<number[][]>(() => questions.map(() => []));
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const router = useRouter();
  const allAnswered = answers.every((a) => a.length > 0);

  function choose(q: number, option: number, multi: boolean) {
    setAnswers((prev) =>
      prev.map((a, i) => {
        if (i !== q) return a;
        if (!multi) return [option];
        return a.includes(option) ? a.filter((o) => o !== option) : [...a, option];
      }),
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/learn/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, answers }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: Result = await res.json();
      setResult(data);
      setStatus("idle");
      if (data.newlyCompleted) router.refresh();
    } catch {
      setStatus("error");
    }
  }

  const locked = Boolean(result);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        {questions.length} question{questions.length === 1 ? "" : "s"} · pass mark {passPercent}%
        {completed && !result && <span className="text-pine"> · You have passed this quiz</span>}
      </p>

      {result && (
        <div
          role="status"
          className={`rounded-2xl border p-5 ${result.passed ? "border-mint bg-mint/30" : "border-saffron/50 bg-saffron/10"}`}
        >
          <p className="text-3xl font-semibold tracking-[-0.02em]">{result.scorePercent}%</p>
          <p className="mt-1 font-medium">
            {result.passed
              ? "Passed. Well done."
              : `Not quite: you need ${result.passPercent}% to pass. Review the questions marked below and try again.`}
          </p>
          {!result.passed && (
            <button
              type="button"
              onClick={() => setResult(null)}
              className="mt-4 h-11 rounded-full bg-ink px-6 text-sm font-medium text-paper transition-colors hover:bg-pine"
            >
              Try again
            </button>
          )}
        </div>
      )}
      {result?.passed && (
        <CompletionNotice certificate={Boolean(result.certificate)} nextHref={nextHref} />
      )}

      <form onSubmit={submit} className="space-y-5">
        {questions.map((q, i) => {
          const right = result?.perQuestion[i];
          const explanation = result?.explanations?.[i];
          return (
            <fieldset key={i} disabled={locked} className="rounded-2xl border border-line bg-white p-5">
              <legend className="sr-only">Question {i + 1}</legend>
              <p className="font-medium leading-snug">
                <span className="text-muted">{i + 1}. </span>
                {q.prompt}
              </p>
              {q.multi && <p className="mt-1 text-xs text-muted">Select all that apply.</p>}
              <div className="mt-4 space-y-2">
                {q.options.map((option, o) => (
                  <label
                    key={o}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-2.5 text-[0.95rem] transition-colors has-checked:border-pine has-checked:bg-mint/30 has-disabled:cursor-default"
                  >
                    <input
                      type={q.multi ? "checkbox" : "radio"}
                      name={`q${i}`}
                      checked={answers[i].includes(o)}
                      onChange={() => choose(i, o, q.multi)}
                      className="size-4 shrink-0 accent-pine"
                    />
                    {option}
                  </label>
                ))}
              </div>
              {right !== undefined && (
                <p className={`mt-3 text-sm font-medium ${right ? "text-pine" : "text-red-700"}`}>
                  {right ? "Correct" : "Incorrect"}
                </p>
              )}
              {explanation && <p className="mt-1 text-sm leading-relaxed text-muted">{explanation}</p>}
            </fieldset>
          );
        })}

        {!result && (
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={!allAnswered || status === "sending"}
              className="h-12 rounded-full bg-ink px-7 text-sm font-medium text-paper transition-colors hover:bg-pine disabled:opacity-50"
            >
              {status === "sending" ? "Checking…" : "Submit answers"}
            </button>
            {!allAnswered && <p className="text-sm text-muted">Answer every question to submit.</p>}
            {status === "error" && (
              <p role="alert" className="text-sm text-red-700">
                Couldn&apos;t submit. Check your connection and try again.
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
