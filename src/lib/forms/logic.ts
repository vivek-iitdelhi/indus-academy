// Pure form logic shared by the public form (client) and its server action: pages,
// Google-style branching, per-question validation, cleaning a submitted response,
// pre-fill links, file-kind matching and plain-text answers. Imports only ./types.ts.

import { isQuestion } from "./types.ts";
import type { Answer, Answers, FileKind, FormFile, FormItem, GoTo, QuestionItem, TextValidation } from "./types.ts";

// --- Pages and branching -----------------------------------------------------

/** Items split into pages. Page 0 is the form header page; every section item starts (and heads) a new page. */
export function pages(items: FormItem[]): FormItem[][] {
  const out: FormItem[][] = [[]];
  for (const item of items) {
    if (item.type === "section") out.push([item]);
    else out[out.length - 1].push(item);
  }
  return out;
}

const resolveGoTo = (all: FormItem[][], from: number, goTo: GoTo | undefined): number | "submit" => {
  if (goTo === "submit") return "submit";
  if (goTo && goTo !== "next") {
    const target = all.findIndex((page) => page[0]?.type === "section" && page[0].id === goTo);
    if (target >= 0) return target;
  }
  return from + 1 < all.length ? from + 1 : "submit";
};

/**
 * Where to go after page `pageIndex`: a branching choice/dropdown answered on the page routes by
 * the chosen option's goTo (the last such question answered wins); otherwise the next section's
 * goTo; otherwise the next page. After the last page: submit.
 */
export function nextPage(items: FormItem[], pageIndex: number, answers: Answers): number | "submit" {
  const all = pages(items);
  const page = all[pageIndex] ?? [];
  let goTo: GoTo | undefined;
  let branched = false;
  for (const item of page) {
    if ((item.type === "choice" || item.type === "dropdown") && item.branching) {
      const answer = answers[item.id];
      if (typeof answer !== "string" || !answer.trim()) continue;
      // "Other" text has no goTo of its own: it continues to the next page.
      goTo = item.options.find((o) => o.label === answer.trim())?.goTo ?? "next";
      branched = true;
    }
  }
  if (!branched) {
    const following = all[pageIndex + 1]?.[0];
    goTo = following?.type === "section" ? following.goTo : undefined;
  }
  return resolveGoTo(all, pageIndex, goTo);
}

/** The pages a respondent visits from `start` until submit, given `answers`. Stops if a branch loops back. */
export function pathFrom(items: FormItem[], start: number, answers: Answers): number[] {
  const seen: number[] = [];
  for (let page: number | "submit" = start; page !== "submit" && !seen.includes(page); page = nextPage(items, page, answers)) {
    seen.push(page);
  }
  return seen;
}

// --- Cleaning ----------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Trims strings and drops empty parts; returns undefined for an empty answer. Values of the
 * wrong shape are returned as they are, so validateAnswer reports them.
 */
export function cleanAnswer(item: QuestionItem, answer: unknown): unknown {
  if (answer === undefined || answer === null) return undefined;
  switch (item.type) {
    case "short":
    case "paragraph":
    case "choice":
    case "dropdown":
    case "date":
    case "time": {
      if (typeof answer !== "string") return answer;
      const s = answer.trim();
      return s === "" ? undefined : s;
    }
    case "checkboxes": {
      if (!Array.isArray(answer)) return answer;
      if (answer.some((v) => typeof v !== "string")) return answer;
      const list = [...new Set((answer as string[]).map((v) => v.trim()).filter(Boolean))];
      return list.length ? list : undefined;
    }
    case "scale":
    case "rating":
      return answer === "" ? undefined : answer;
    case "choiceGrid":
    case "checkboxGrid": {
      if (!isObject(answer)) return answer;
      const out: Record<string, unknown> = {};
      for (const [row, value] of Object.entries(answer)) {
        if (Array.isArray(value)) {
          if (value.length) out[row] = value;
        } else if (value !== "" && value !== undefined && value !== null) out[row] = value;
      }
      return Object.keys(out).length ? out : undefined;
    }
    case "file":
      return Array.isArray(answer) && answer.length === 0 ? undefined : answer;
  }
}

// --- Validation --------------------------------------------------------------

export const REQUIRED = "This is a required question";
/** The error key of the typed respondent email (collectEmail "input"); other errors are keyed by item id. */
export const EMAIL_FIELD = "$email";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isUrl = (s: string) => {
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(s) ? s : `https://${s}`);
    return /^https?:$/.test(url.protocol) && url.hostname.includes(".");
  } catch {
    return false;
  }
};
export const isEmail = (s: string) => EMAIL.test(s);

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
const regex = (pattern: string) => {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
};

function textError(s: string, v: TextValidation): string | null {
  const fail = (fallback: string) => v.message?.trim() || fallback;
  switch (v.kind) {
    case "number": {
      const n = NUMBER.test(s) ? Number(s) : NaN;
      const a = v.a ?? 0;
      const b = v.b ?? 0;
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      if (!Number.isFinite(n)) return fail(v.op === "whole" ? "Must be a whole number" : "Must be a number");
      const checks: Record<typeof v.op, [boolean, string]> = {
        gt: [n > a, `Must be a number greater than ${a}`],
        gte: [n >= a, `Must be a number greater than or equal to ${a}`],
        lt: [n < a, `Must be a number less than ${a}`],
        lte: [n <= a, `Must be a number less than or equal to ${a}`],
        eq: [n === a, `Must be a number equal to ${a}`],
        neq: [n !== a, `Must be a number not equal to ${a}`],
        between: [n >= lo && n <= hi, `Must be a number between ${lo} and ${hi}`],
        notBetween: [n < lo || n > hi, `Must be a number not between ${lo} and ${hi}`],
        isNumber: [true, ""],
        whole: [Number.isInteger(n), "Must be a whole number"],
      };
      const [ok, message] = checks[v.op];
      return ok ? null : fail(message);
    }
    case "text": {
      const value = v.value ?? "";
      if (v.op === "contains") return s.includes(value) ? null : fail(`Must contain ${value}`);
      if (v.op === "notContains") return value && s.includes(value) ? fail(`Must not contain ${value}`) : null;
      if (v.op === "email") return isEmail(s) ? null : fail("Must be an email");
      return isUrl(s) ? null : fail("Must be a URL");
    }
    case "length":
      return lengthError(s, v);
    case "regex":
      return regexError(s, v);
  }
}

function lengthError(s: string, v: { op: "max" | "min"; n: number; message?: string }) {
  const length = [...s].length;
  const ok = v.op === "max" ? length <= v.n : length >= v.n;
  return ok ? null : v.message?.trim() || `Must be at ${v.op === "max" ? "most" : "least"} ${plural(v.n, "character")}`;
}

function regexError(s: string, v: { op: "contains" | "notContains" | "matches" | "notMatches"; pattern: string; message?: string }) {
  const re = regex(v.op === "matches" || v.op === "notMatches" ? `^(?:${v.pattern})$` : v.pattern);
  if (!re) return null; // a broken pattern is the builder's mistake, not the respondent's
  const hit = re.test(s);
  const ok = v.op === "contains" || v.op === "matches" ? hit : !hit;
  const fallback = { contains: "Must contain the required pattern", notContains: "Must not contain the pattern", matches: "Must match the required pattern", notMatches: "Must not match the pattern" }[v.op];
  return ok ? null : v.message?.trim() || fallback;
}

const daysIn = (month: number, year?: number) => new Date(Date.UTC(year ?? 2000 /* leap: allows 29 Feb */, month, 0)).getUTCDate();

function dateError(s: string, includeYear: boolean, includeTime: boolean) {
  const m = (includeYear ? /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/ : /^()(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/).exec(s);
  if (!m) return "Invalid date";
  const [, y, mo, d, hh, mm] = m;
  const month = Number(mo);
  if (month < 1 || month > 12 || Number(d) < 1 || Number(d) > daysIn(month, includeYear ? Number(y) : undefined)) return "Invalid date";
  if (includeTime && hh === undefined) return "Invalid time";
  if (!includeTime && hh !== undefined) return "Invalid date";
  if (hh !== undefined && (Number(hh) > 23 || Number(mm) > 59)) return "Invalid time";
  return null;
}

function timeError(s: string, duration: boolean) {
  if (duration) {
    const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(s);
    return m && Number(m[2]) < 60 && Number(m[3]) < 60 ? null : "Invalid duration";
  }
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? null : "Invalid time";
}

const isFormFile = (f: unknown): f is FormFile =>
  isObject(f) && typeof f.key === "string" && typeof f.name === "string" && typeof f.type === "string" && typeof f.size === "number" && f.size >= 0;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Why `answer` is not acceptable for `item` (after cleaning), or null if it is. */
export function validateAnswer(item: QuestionItem, raw: unknown): string | null {
  const answer = cleanAnswer(item, raw);
  if (answer === undefined) return item.required ? REQUIRED : null;
  const invalid = "Invalid answer";

  switch (item.type) {
    case "short":
      if (typeof answer !== "string") return invalid;
      return item.validation ? textError(answer, item.validation) : null;
    case "paragraph":
      if (typeof answer !== "string") return invalid;
      if (!item.validation) return null;
      return item.validation.kind === "length" ? lengthError(answer, item.validation) : regexError(answer, item.validation);
    case "choice":
      if (typeof answer !== "string") return invalid;
      return item.other || item.options.some((o) => o.label === answer) ? null : "Choose one of the options";
    case "dropdown":
      if (typeof answer !== "string") return invalid;
      return item.options.some((o) => o.label === answer) ? null : "Choose one of the options";
    case "checkboxes": {
      if (!Array.isArray(answer)) return invalid;
      const others = (answer as string[]).filter((v) => !item.options.some((o) => o.label === v));
      if (others.length > (item.other ? 1 : 0)) return "Choose from the options";
      const v = item.validation;
      if (!v) return null;
      const n = answer.length;
      const ok = v.op === "atLeast" ? n >= v.n : v.op === "atMost" ? n <= v.n : n === v.n;
      const word = { atLeast: "at least", atMost: "at most", exactly: "exactly" }[v.op];
      return ok ? null : v.message?.trim() || `Select ${word} ${plural(v.n, "option")}`;
    }
    case "scale":
      return Number.isInteger(answer) && (answer as number) >= item.min && (answer as number) <= item.max ? null : invalid;
    case "rating":
      return Number.isInteger(answer) && (answer as number) >= 1 && (answer as number) <= item.max ? null : invalid;
    case "choiceGrid":
    case "checkboxGrid": {
      if (!isObject(answer)) return invalid;
      const multi = item.type === "checkboxGrid";
      const used: string[] = [];
      for (const [row, value] of Object.entries(answer)) {
        if (!item.rows.includes(row)) return invalid;
        const cols = multi ? value : [value];
        if (!Array.isArray(cols) || cols.some((c) => typeof c !== "string" || !item.columns.includes(c))) return invalid;
        if (new Set(cols).size !== cols.length) return invalid;
        used.push(...(cols as string[]));
      }
      if (item.requireEachRow && item.rows.some((row) => !(row in answer))) return "This question requires one response per row";
      if (item.onePerColumn && new Set(used).size !== used.length) return "Please don't select more than one response per column";
      return null;
    }
    case "date":
      return typeof answer === "string" ? dateError(answer, item.includeYear, item.includeTime) : invalid;
    case "time":
      return typeof answer === "string" ? timeError(answer, item.duration) : invalid;
    case "file": {
      if (!Array.isArray(answer) || !answer.every(isFormFile)) return invalid;
      if (answer.length > item.maxFiles) return `Upload at most ${plural(item.maxFiles, "file")}`;
      const big = answer.find((f) => f.size > item.maxSizeMb * 1024 * 1024);
      if (big) return `${big.name} is larger than ${item.maxSizeMb} MB`;
      const wrong = item.accept?.length ? answer.find((f) => !fileAccepted(item.accept!, f.name)) : undefined;
      return wrong ? `${wrong.name} is not an allowed file type` : null;
    }
  }
}

/**
 * Validates a whole response along the path its answers take from page 0. Returns the cleaned
 * answers of visited questions only (answers to skipped pages and unknown ids are dropped)
 * and the errors by item id.
 */
export function checkResponse(items: FormItem[], answers: Answers): { answers: Answers; errors: Record<string, string> } {
  const all = pages(items);
  const out: Answers = {};
  const errors: Record<string, string> = {};
  const source: Record<string, unknown> = isObject(answers) ? answers : {};
  for (const index of pathFrom(items, 0, source as Answers)) {
    for (const item of all[index]) {
      if (!isQuestion(item)) continue;
      const own = Object.prototype.hasOwnProperty.call(source, item.id) ? source[item.id] : undefined;
      const error = validateAnswer(item, own);
      if (error) errors[item.id] = error;
      else {
        const clean = cleanAnswer(item, own);
        if (clean !== undefined) out[item.id] = clean as Answer;
      }
    }
  }
  return { answers: out, errors };
}

// --- Files -------------------------------------------------------------------

const kindExtensions: Record<FileKind, string[]> = {
  document: ["doc", "docx", "odt", "rtf", "txt", "pages"],
  spreadsheet: ["xls", "xlsx", "ods", "csv", "numbers"],
  pdf: ["pdf"],
  video: ["mp4", "mov", "m4v", "webm", "mkv", "avi", "3gp"],
  presentation: ["ppt", "pptx", "odp", "key"],
  drawing: ["svg", "ai", "eps", "vsd", "vsdx", "drawio"],
  image: ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "tif", "tiff", "svg"],
  audio: ["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac", "opus", "weba"],
};

const extension = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? "";

/** True if a file called `name` is one of `kinds` (by extension: the browser's MIME type is only a claim). */
export const fileAccepted = (kinds: FileKind[], name: string) => kinds.some((kind) => kindExtensions[kind]?.includes(extension(name)));

/** The `accept` attribute for a file input limited to `kinds`. */
export const acceptAttribute = (kinds: FileKind[] | undefined) =>
  kinds?.length ? kinds.flatMap((kind) => kindExtensions[kind].map((ext) => `.${ext}`)).join(",") : undefined;

// --- Pre-fill links ------------------------------------------------------------

type Query = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Answers from Google-style `entry.<itemId>=value` params (repeat for checkboxes; grids `entry.<itemId>.<row>=col`). */
export function answersFromQuery(items: FormItem[], query: Query): Answers {
  const out: Answers = {};
  for (const item of items) {
    if (!isQuestion(item) || item.type === "file") continue;
    const key = `entry.${item.id}`;
    const values = list(query[key]);
    if (item.type === "choiceGrid" || item.type === "checkboxGrid") {
      const grid: Record<string, string | string[]> = {};
      for (const row of item.rows) {
        const cols = list(query[`${key}.${row}`]);
        if (cols.length) grid[row] = item.type === "checkboxGrid" ? cols : cols[0];
      }
      if (Object.keys(grid).length) out[item.id] = grid as Answer;
    } else if (values.length) {
      if (item.type === "checkboxes") out[item.id] = values;
      else if (item.type === "scale" || item.type === "rating") {
        const n = Number(values[0]);
        if (Number.isInteger(n)) out[item.id] = n;
      } else out[item.id] = values[0];
    }
  }
  return out;
}

/** The query string (without "?") that pre-fills `answers`; the inverse of answersFromQuery. */
export function prefillQuery(items: FormItem[], answers: Answers): string {
  const params = new URLSearchParams();
  for (const item of items) {
    const answer = answers[item.id];
    if (!isQuestion(item) || answer === undefined || item.type === "file") continue;
    const key = `entry.${item.id}`;
    if (item.type === "choiceGrid" || item.type === "checkboxGrid") {
      for (const [row, cols] of Object.entries(answer as Record<string, string | string[]>)) {
        for (const col of list(cols)) params.append(`${key}.${row}`, col);
      }
    } else for (const v of list(answer as string | string[])) params.append(key, String(v));
  }
  return params.toString();
}

// --- Display -------------------------------------------------------------------

/** A YouTube video id from a watch?v=, youtu.be/, shorts/, embed/ or live/ link, or null. */
export function youTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      id = u.searchParams.get("v") ?? /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname)?.[1] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

const formatDate = (s: string) => s.replace("T", " ");

/** One answer as plain text (for emails and summaries). */
export function formatAnswer(item: QuestionItem, answer: Answer | undefined): string {
  if (answer === undefined) return "";
  switch (item.type) {
    case "checkboxes":
      return (answer as string[]).join(", ");
    case "rating":
      return `${answer} / ${item.max}`;
    case "scale":
      return `${answer} (${item.min}–${item.max})`;
    case "choiceGrid":
    case "checkboxGrid":
      return item.rows
        .filter((row) => (answer as Record<string, string | string[]>)[row] !== undefined)
        .map((row) => `${row}: ${list((answer as Record<string, string | string[]>)[row]).join(", ")}`)
        .join("\n");
    case "file":
      return (answer as FormFile[]).map((f) => f.name).join(", ");
    case "date":
      return formatDate(String(answer));
    default:
      return String(answer);
  }
}
