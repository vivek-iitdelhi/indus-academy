// Answers as text, and responses as a Google Forms-style CSV sheet. Pure (no db, no `@/`)
// so node tests can load it.
import { isQuestion, type Answer, type Answers, type FormFile, type FormItem, type QuestionItem } from "./types.ts";

type Grid = Record<string, string | string[]>;
const isGrid = (item: QuestionItem): item is Extract<QuestionItem, { rows: string[] }> =>
  item.type === "choiceGrid" || item.type === "checkboxGrid";

/** The files in an answer (anything else: none). Answers are jsonb, so check the shape. */
export const answerFiles = (answer: Answer | undefined): FormFile[] =>
  Array.isArray(answer) ? answer.filter((a): a is FormFile => typeof a === "object" && a !== null && typeof a.key === "string") : [];

/** Every file in a response. */
export const responseFiles = (answers: Answers): FormFile[] => Object.values(answers).flatMap(answerFiles);

/** One grid row's answer as text ("" when that row was left blank). */
export const gridCell = (answer: Answer | undefined, row: string) =>
  answer && typeof answer === "object" && !Array.isArray(answer) ? [(answer as Grid)[row] ?? []].flat().join(", ") : "";

/** An answer as readable text; "" when unanswered. */
export function answerText(item: QuestionItem, answer: Answer | undefined): string {
  if (answer == null) return "";
  if (Array.isArray(answer)) return answer.map((a) => (typeof a === "object" && a !== null ? a.name : String(a))).join(", ");
  if (typeof answer === "object") {
    // Rows in form order, then any rows renamed or removed since this response.
    const rows = [...new Set([...(isGrid(item) ? item.rows : []), ...Object.keys(answer)])];
    return rows
      .map((row) => [row, gridCell(answer, row)])
      .filter(([, cell]) => cell)
      .map(([row, cell]) => `${row}: ${cell}`)
      .join("; ");
  }
  if (item.type === "date") return String(answer).replace("T", " ");
  return String(answer);
}

/** RFC 4180 cell; cells a spreadsheet would run as a formula get a leading '. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export type CsvResponse = { createdAt: Date; email: string | null; answers: Answers };

/** "2026-10-22 14:30:05" in India time: sorts as text and spreadsheets read it as a date. */
const timestamp = (date: Date) => date.toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });

/**
 * Like the Google Forms sheet: Timestamp, Email Address (if any response has one), then one
 * column per question in form order (grids: one per row, "Question [Row]"). Answers to
 * questions since deleted from the form are left out.
 */
export function responsesCsv(form: { items: FormItem[] }, responses: CsvResponse[]): string {
  const withEmail = responses.some((r) => r.email);
  const columns: { title: string; cell: (answers: Answers) => string }[] = form.items.filter(isQuestion).flatMap((item) =>
    isGrid(item)
      ? item.rows.map((row) => ({ title: `${item.title} [${row}]`, cell: (a: Answers) => gridCell(a[item.id], row) }))
      : [{ title: item.title, cell: (a: Answers) => answerText(item, a[item.id]) }],
  );
  const head = ["Timestamp", ...(withEmail ? ["Email Address"] : []), ...columns.map((c) => c.title)];
  const rows = responses.map((r) => [timestamp(r.createdAt), ...(withEmail ? [r.email ?? ""] : []), ...columns.map((c) => c.cell(r.answers))]);
  return [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
