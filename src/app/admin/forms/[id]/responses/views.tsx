import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { formResponses, type Form } from "@/db/schema";
import { formatDateTime } from "@/lib/admin/ops";
import { answerFiles, answerText, gridCell } from "@/lib/forms/export";
import { isQuestion, type Answer, type FormFile, type QuestionItem } from "@/lib/forms/types";
import { ConfirmButton } from "../../../courses/client";
import { Badge, btn, PAGE_SIZE, Pager } from "../../../learners/admin-ui";
import { deleteResponse } from "./actions";
import { allResponses, MAX_RESPONSES } from "./data";

// The three responses views: Summary (charts per question), Question (one question's
// answers grouped) and Individual (one response at a time). Server components.

const LATEST = 25;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const pct = (n: number, of: number) => (of ? Math.round((n * 100) / of) : 0);
const fileHref = (formId: string, key: string) => `/api/admin/forms/${formId}/file?${new URLSearchParams({ key })}`;
const questionHref = (formId: string, qid: string) => `/admin/forms/${formId}/responses?${new URLSearchParams({ view: "question", q: qid })}`;
const card = "rounded-2xl border border-line bg-white p-5 sm:p-6";

/** Answers are jsonb: blank strings, empty lists and empty grids count as unanswered. */
const answered = (a: Answer | null | undefined): a is Answer =>
  a != null && a !== "" && (typeof a !== "object" || Object.keys(a).length > 0);

const shade = (share: number): CSSProperties => ({ backgroundColor: `color-mix(in srgb, var(--color-pine) ${Math.round(share * 70)}%, transparent)` });

export function WaitingForResponses({ slug }: { slug: string }) {
  return (
    <div className={`${card} mt-6 text-center`}>
      <p className="text-lg font-medium">Waiting for responses</p>
      <p className="mt-2 text-sm text-muted">
        Share the form:{" "}
        <a href={`/forms/${slug}`} className="font-mono text-pine underline">
          /forms/{slug}
        </a>
      </p>
    </div>
  );
}

function FileLinks({ formId, files }: { formId: string; files: FormFile[] }) {
  return (
    <ul className="space-y-1">
      {files.map((f) => (
        <li key={f.key}>
          <a href={fileHref(formId, f.key)} className="text-pine underline">
            {f.name}
          </a>{" "}
          <span className="text-xs text-muted">{Math.max(1, Math.round(f.size / 1024))} KB</span>
        </li>
      ))}
    </ul>
  );
}

// --- Summary ------------------------------------------------------------------

function Bars({ rows, of }: { rows: { label: string; count: number }[]; of: number }) {
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(6rem,14rem)_1fr_6rem] items-center gap-3">
          <span className="truncate" title={r.label}>
            {r.label}
          </span>
          <span className="h-5 rounded bg-ink/[0.05]">
            <span className="block h-full rounded bg-pine" style={{ width: `${pct(r.count, of)}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted">
            {r.count} ({pct(r.count, of)}%)
          </span>
        </li>
      ))}
    </ul>
  );
}

function Columns({ values }: { values: { label: string; count: number }[] }) {
  const top = Math.max(1, ...values.map((v) => v.count));
  return (
    <div className="flex h-44 items-end gap-2">
      {values.map((v) => (
        <div key={v.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1 text-xs">
          <span className="tabular-nums text-muted">{v.count}</span>
          <span className="w-full max-w-12 rounded-t bg-pine" style={{ height: `${(v.count * 100) / top}%`, minHeight: v.count ? 2 : 0 }} />
          <span className="font-medium">{v.label}</span>
        </div>
      ))}
    </div>
  );
}

function MoreLink({ formId, qid, more }: { formId: string; qid: string; more: number }) {
  if (more <= 0) return null;
  return (
    <Link href={questionHref(formId, qid)} className="mt-3 inline-block text-sm text-pine underline">
      {more} more
    </Link>
  );
}

function QuestionSummary({ formId, item, answers }: { formId: string; item: QuestionItem; answers: Answer[] }) {
  // `answers` are this question's answered values, newest first.
  switch (item.type) {
    case "choice":
    case "dropdown":
    case "checkboxes": {
      const labels = item.options.map((o) => o.label);
      const counts = new Map(labels.map((l) => [l, 0]));
      const others: string[] = [];
      for (const a of answers)
        for (const v of [a].flat().map(String)) {
          if (counts.has(v)) counts.set(v, counts.get(v)! + 1);
          else others.push(v);
        }
      const rows = [...counts].map(([label, count]) => ({ label, count }));
      if (others.length) rows.push({ label: "Other", count: others.length });
      return (
        <>
          <Bars rows={rows} of={answers.length} />
          {others.length > 0 && (
            <div className="mt-4 text-sm">
              <p className="font-medium">Other</p>
              <ul className="mt-1 list-disc pl-5 text-muted">
                {others.slice(0, LATEST).map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
              <MoreLink formId={formId} qid={item.id} more={others.length - LATEST} />
            </div>
          )}
        </>
      );
    }
    case "scale":
    case "rating": {
      const from = item.type === "scale" ? item.min : 1;
      const values = Array.from({ length: Math.max(0, item.max - from + 1) }, (_, i) => ({
        label: String(from + i),
        count: answers.filter((a) => Number(a) === from + i).length,
      }));
      return (
        <>
          <Columns values={values} />
          {item.type === "scale" && (item.minLabel || item.maxLabel) && (
            <p className="mt-2 flex justify-between text-xs text-muted">
              <span>{item.minLabel}</span>
              <span>{item.maxLabel}</span>
            </p>
          )}
        </>
      );
    }
    case "choiceGrid":
    case "checkboxGrid":
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th />
                {item.columns.map((c) => (
                  <th key={c} className="px-3 py-2 text-center font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {item.rows.map((row) => {
                const cells = answers.map((a) => [(a as Record<string, string | string[]>)[row] ?? []].flat()).filter((c) => c.length);
                return (
                  <tr key={row} className="border-t border-line">
                    <th className="px-3 py-2 text-left font-medium">{row}</th>
                    {item.columns.map((col) => {
                      const n = cells.filter((c) => c.includes(col)).length;
                      return (
                        <td key={col} className="px-3 py-2 text-center tabular-nums" style={shade(cells.length ? n / cells.length : 0)} title={`${pct(n, cells.length)}% of ${cells.length}`}>
                          {n}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    case "file":
      return (
        <>
          <FileLinks formId={formId} files={answers.slice(0, LATEST).flatMap(answerFiles)} />
          <MoreLink formId={formId} qid={item.id} more={answers.length - LATEST} />
        </>
      );
    default:
      return (
        <>
          <ul className="divide-y divide-line rounded-xl bg-ink/[0.03] text-sm">
            {answers.slice(0, LATEST).map((a, i) => (
              <li key={i} className="whitespace-pre-wrap px-3 py-2">
                {answerText(item, a)}
              </li>
            ))}
          </ul>
          <MoreLink formId={formId} qid={item.id} more={answers.length - LATEST} />
        </>
      );
  }
}

export async function SummaryView({ form }: { form: Form }) {
  const responses = (await allResponses(form.id)).reverse(); // newest first
  return (
    <div className="mt-6 space-y-4">
      {responses.length === MAX_RESPONSES && <p className="text-sm text-muted">Showing the first {MAX_RESPONSES} responses.</p>}
      {form.items.filter(isQuestion).map((item) => {
        const answers = responses.map((r) => r.answers[item.id]).filter(answered);
        return (
          <section key={item.id} className={card}>
            <h3 className="font-semibold">{item.title || "Untitled question"}</h3>
            <p className="mb-4 text-sm text-muted">{plural(answers.length, "response")}</p>
            {answers.length ? <QuestionSummary formId={form.id} item={item} answers={answers} /> : <p className="text-sm text-muted">No responses yet to this question.</p>}
          </section>
        );
      })}
    </div>
  );
}

// --- Question -----------------------------------------------------------------

export async function QuestionView({ form, qid, page }: { form: Form; qid: string; page: number }) {
  const questions = form.items.filter(isQuestion);
  const index = Math.max(0, questions.findIndex((q) => q.id === qid));
  const item = questions[index];
  if (!item) return <p className="mt-6 text-muted">This form has no questions.</p>;

  // Only this question's answers, newest first.
  const rows = await db
    .select({ answer: sql<Answer | null>`${formResponses.answers} -> ${item.id}::text` })
    .from(formResponses)
    .where(eq(formResponses.formId, form.id))
    .orderBy(desc(formResponses.createdAt), desc(formResponses.id))
    .limit(MAX_RESPONSES);
  const answers = rows.map((r) => r.answer).filter(answered);

  // Identical answers grouped, most common first (files are listed one response per row).
  const groups: { text: ReactNode; count: number }[] = [];
  if (item.type === "file") {
    for (const a of answers) groups.push({ text: <FileLinks formId={form.id} files={answerFiles(a)} />, count: 1 });
  } else {
    const counts = new Map<string, number>();
    for (const a of answers) counts.set(answerText(item, a), (counts.get(answerText(item, a)) ?? 0) + 1);
    for (const [text, count] of [...counts].sort((x, y) => y[1] - x[1])) groups.push({ text, count });
  }
  const shown = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const step = (i: number) => questions[i] && questionHref(form.id, questions[i].id);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        {step(index - 1) ? <Link href={step(index - 1)!} className={btn} aria-label="Previous question">‹</Link> : null}
        <form className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="view" value="question" />
          <select name="q" defaultValue={item.id} aria-label="Question" className="h-9 max-w-md rounded-xl border border-line bg-paper px-3 text-sm">
            {questions.map((q, i) => (
              <option key={q.id} value={q.id}>
                {i + 1}. {q.title || "Untitled question"}
              </option>
            ))}
          </select>
          <button className={btn}>Show</button>
        </form>
        {step(index + 1) ? <Link href={step(index + 1)!} className={btn} aria-label="Next question">›</Link> : null}
        <span className="text-sm text-muted">
          {index + 1} of {questions.length}
        </span>
      </div>
      <section className={`${card} mt-4`}>
        <h3 className="font-semibold">{item.title || "Untitled question"}</h3>
        <p className="mb-4 text-sm text-muted">{plural(answers.length, "response")}</p>
        {shown.length ? (
          <ul className="divide-y divide-line text-sm">
            {shown.map((g, i) => (
              <li key={i} className="flex items-start justify-between gap-4 py-2">
                <div className="min-w-0 whitespace-pre-wrap">{g.text}</div>
                {g.count > 1 && <Badge>{plural(g.count, "response")}</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No responses yet to this question.</p>
        )}
        <Pager path={`/admin/forms/${form.id}/responses`} params={{ view: "question", q: item.id }} page={page} hasMore={groups.length > page * PAGE_SIZE} />
      </section>
    </div>
  );
}

// --- Individual ---------------------------------------------------------------

function AnswerView({ formId, item, answer }: { formId: string; item: QuestionItem; answer: Answer | undefined }) {
  if (!answered(answer)) return <p className="text-sm text-muted">No answer</p>;
  if (item.type === "file") return <FileLinks formId={formId} files={answerFiles(answer)} />;
  if (item.type === "choiceGrid" || item.type === "checkboxGrid")
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {item.rows.map((row) => (
          <div key={row} className="contents">
            <dt className="text-muted">{row}</dt>
            <dd>{gridCell(answer, row) || "—"}</dd>
          </div>
        ))}
      </dl>
    );
  return <p className="whitespace-pre-wrap text-sm">{answerText(item, answer)}</p>;
}

export async function IndividualView({ form, n, total }: { form: Form; n: number; total: number }) {
  const at = Math.min(n, total);
  const [response] = await db
    .select()
    .from(formResponses)
    .where(eq(formResponses.formId, form.id))
    .orderBy(asc(formResponses.createdAt), asc(formResponses.id))
    .offset(at - 1)
    .limit(1);
  if (!response) return null;
  const href = (i: number) => `/admin/forms/${form.id}/responses?view=individual&n=${i}`;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Responses" className="flex items-center gap-2 text-sm">
          {at > 1 ? <Link href={href(at - 1)} className={btn} aria-label="Previous response">‹</Link> : <span className={`${btn} opacity-40`}>‹</span>}
          <span className="tabular-nums">
            {at} of {total}
          </span>
          {at < total ? <Link href={href(at + 1)} className={btn} aria-label="Next response">›</Link> : <span className={`${btn} opacity-40`}>›</span>}
        </nav>
        <form action={deleteResponse.bind(null, form.id, response.id)}>
          <ConfirmButton message="Delete this response and its uploaded files? This can't be undone." className={`${btn} text-red-800`}>
            Delete response
          </ConfirmButton>
        </form>
      </div>
      <div className={`${card} mt-4 space-y-5`}>
        <p className="text-sm text-muted">
          Submitted {formatDateTime(response.createdAt)}
          {response.updatedAt.getTime() - response.createdAt.getTime() > 1000 && ` · edited ${formatDateTime(response.updatedAt)}`}
          {response.email && (
            <>
              {" · "}
              <span className="text-ink">{response.email}</span>
            </>
          )}
        </p>
        {form.items.map((item) =>
          item.type === "section" || item.type === "text" ? (
            <div key={item.id} className={item.type === "section" ? "border-t border-line pt-5" : ""}>
              <h3 className={item.type === "section" ? "text-lg font-semibold" : "font-semibold"}>{item.title}</h3>
              {item.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{item.description}</p>}
            </div>
          ) : isQuestion(item) ? (
            <div key={item.id}>
              <p className="mb-1 font-medium">
                {item.title || "Untitled question"}
                {item.required && <span className="text-red-800"> *</span>}
              </p>
              <AnswerView formId={form.id} item={item} answer={response.answers[item.id]} />
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
