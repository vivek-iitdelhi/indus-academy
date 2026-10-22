import {
  defaultSettings,
  fileKinds,
  isQuestion,
  type Answers,
  type ChoiceOption,
  type FileKind,
  type FormItem,
  type FormItemType,
  type FormSettings,
  type GoTo,
  type LengthValidation,
  type RegexValidation,
  type TextValidation,
} from "../forms/types.ts";

// Pure helpers for the form builder (/admin/forms). No database and no "@/" imports: the
// editor runs normalizeItems in the browser before saving, and node tests load this file.

export const MAX_ITEMS = 300;
const MAX_OPTIONS = 200;
const MAX_TITLE = 500;
const MAX_TEXT = 5000;
const MAX_LABEL = 500;
const MAX_MESSAGE = 300;
const ID_PATTERN = /^[\w-]{1,64}$/;

type Raw = Record<string, unknown>;
type ItemResult = { item: FormItem } | { error: string };
export type NormalizeError = { error: string; index?: number };

const isObject = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const optStr = (v: unknown, max: number) => str(v, max) || undefined;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = num(v);
  return n === undefined ? fallback : Math.min(max, Math.max(min, Math.round(n)));
};
const oneOf = <T>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
/** Spreads `{ [key]: true }` only when set, so stored items stay small. */
const flag = <K extends string>(key: K, v: unknown) => (v === true ? { [key]: true } : {}) as { [P in K]?: true };

export const validRegex = (pattern: string) => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

export const isHttpUrl = (v: string) => /^https?:\/\/[^\s/]+\.[^\s]+$/.test(v);

/** The video id of a YouTube watch / short / embed / youtu.be link, or null. */
export function youtubeId(url: string): string | null {
  const m = url.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#/].*)?$/);
  return m ? m[1] : null;
}

/** Labels, trimmed; blanks become "<fallback> N"; duplicates are an error (answers store labels). */
function labels(raw: unknown, max: number, fallback: string): string[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: `add at least one ${fallback.toLowerCase()}` };
  if (raw.length > max) return { error: `at most ${max} ${fallback.toLowerCase()}s` };
  const out = raw.map((v, i) => str(isObject(v) ? v.label : v, MAX_LABEL) || `${fallback} ${i + 1}`);
  const dup = out.find((label, i) => out.indexOf(label) !== i);
  return dup ? { error: `“${dup}” is listed twice` } : out;
}

function textValidation(v: Raw): TextValidation | { error: string } {
  const message = optStr(v.message, MAX_MESSAGE);
  const extra = message ? { message } : {};
  switch (v.kind) {
    case "number": {
      const op = oneOf(v.op, ["gt", "gte", "lt", "lte", "eq", "neq", "between", "notBetween", "isNumber", "whole"] as const, "isNumber");
      if (op === "isNumber" || op === "whole") return { kind: "number", op, ...extra };
      const a = num(v.a);
      if (a === undefined) return { error: "enter the number to compare with" };
      if (op !== "between" && op !== "notBetween") return { kind: "number", op, a, ...extra };
      const b = num(v.b);
      if (b === undefined) return { error: "enter both numbers of the range" };
      return { kind: "number", op, a: Math.min(a, b), b: Math.max(a, b), ...extra };
    }
    case "text": {
      const op = oneOf(v.op, ["contains", "notContains", "email", "url"] as const, "email");
      if (op === "email" || op === "url") return { kind: "text", op, ...extra };
      const value = str(v.value, MAX_LABEL);
      return value ? { kind: "text", op, value, ...extra } : { error: "enter the text to look for" };
    }
    default:
      return lengthOrRegex(v);
  }
}

function lengthOrRegex(v: Raw): LengthValidation | RegexValidation | { error: string } {
  const message = optStr(v.message, MAX_MESSAGE);
  const extra = message ? { message } : {};
  if (v.kind === "length") {
    if (num(v.n) === undefined) return { error: "enter a character count" };
    return { kind: "length", op: oneOf(v.op, ["max", "min"] as const, "max"), n: int(v.n, 1, 100_000, 1), ...extra };
  }
  if (v.kind === "regex") {
    const pattern = typeof v.pattern === "string" ? v.pattern.slice(0, 500) : "";
    if (!pattern) return { error: "enter a regular expression" };
    if (!validRegex(pattern)) return { error: "the regular expression is not valid" };
    return { kind: "regex", op: oneOf(v.op, ["contains", "notContains", "matches", "notMatches"] as const, "matches"), pattern, ...extra };
  }
  return { error: "unknown response validation" };
}

function goTo(v: unknown, sections: Set<string>): GoTo | { error: string } {
  if (v === undefined || v === "next") return "next";
  if (v === "submit" || (typeof v === "string" && sections.has(v))) return v;
  return { error: "goes to a section that no longer exists" };
}

function options(raw: Raw, branching: boolean, sections: Set<string>): ChoiceOption[] | { error: string } {
  const list = labels(raw.options, MAX_OPTIONS, "Option");
  if ("error" in list) return list;
  const out: ChoiceOption[] = [];
  for (const [i, label] of list.entries()) {
    const opt = (raw.options as unknown[])[i];
    if (!branching) {
      out.push({ label });
      continue;
    }
    const to = goTo(isObject(opt) ? opt.goTo : undefined, sections);
    if (typeof to !== "string") return { error: `option “${label}” ${to.error}` };
    out.push(to === "next" ? { label } : { label, goTo: to });
  }
  return out;
}

function normalizeItem(raw: Raw, sections: Set<string>): ItemResult {
  const description = optStr(raw.description, MAX_TEXT);
  const base = { id: raw.id as string, title: str(raw.title, MAX_TITLE), ...(description ? { description } : {}) };
  const q = { ...base, ...flag("required", raw.required) };
  const validation = isObject(raw.validation) ? raw.validation : undefined;

  switch (raw.type) {
    case "short": {
      if (!validation) return { item: { ...q, type: "short" } };
      const v = textValidation(validation);
      return "error" in v ? v : { item: { ...q, type: "short", validation: v } };
    }
    case "paragraph": {
      if (!validation) return { item: { ...q, type: "paragraph" } };
      const v = lengthOrRegex(validation);
      return "error" in v ? v : { item: { ...q, type: "paragraph", validation: v } };
    }
    case "choice":
    case "dropdown": {
      const branching = raw.branching === true;
      const opts = options(raw, branching, sections);
      if ("error" in opts) return opts;
      const common = { ...q, options: opts, ...flag("shuffle", raw.shuffle), ...flag("branching", branching) };
      return { item: raw.type === "choice" ? { ...common, type: "choice", ...flag("other", raw.other) } : { ...common, type: "dropdown" } };
    }
    case "checkboxes": {
      const opts = options(raw, false, sections);
      if ("error" in opts) return opts;
      const item: FormItem = { ...q, type: "checkboxes", options: opts, ...flag("other", raw.other), ...flag("shuffle", raw.shuffle) };
      if (!validation) return { item };
      if (num(validation.n) === undefined) return { error: "enter how many boxes to tick" };
      const message = optStr(validation.message, MAX_MESSAGE);
      const op = oneOf(validation.op, ["atLeast", "atMost", "exactly"] as const, "atLeast");
      const n = int(validation.n, 1, opts.length + (raw.other === true ? 1 : 0), 1);
      return { item: { ...item, validation: { op, n, ...(message ? { message } : {}) } } };
    }
    case "file": {
      const accept = Array.isArray(raw.accept) ? fileKinds.filter((k) => (raw.accept as unknown[]).includes(k)) : [];
      return {
        item: {
          ...q,
          type: "file",
          maxFiles: oneOf(raw.maxFiles, [1, 5, 10] as const, 1),
          maxSizeMb: oneOf(raw.maxSizeMb, [1, 10, 100] as const, 10),
          ...(accept.length ? { accept: accept as FileKind[] } : {}),
        },
      };
    }
    case "scale": {
      const minLabel = optStr(raw.minLabel, 100);
      const maxLabel = optStr(raw.maxLabel, 100);
      return {
        item: {
          ...q,
          type: "scale",
          min: oneOf(raw.min, [0, 1] as const, 1),
          max: int(raw.max, 2, 10, 5),
          ...(minLabel ? { minLabel } : {}),
          ...(maxLabel ? { maxLabel } : {}),
        },
      };
    }
    case "rating":
      return { item: { ...q, type: "rating", max: int(raw.max, 3, 10, 5), icon: oneOf(raw.icon, ["star", "heart", "thumb"] as const, "star") } };
    case "choiceGrid":
    case "checkboxGrid": {
      const rows = labels(raw.rows, 100, "Row");
      if ("error" in rows) return rows;
      const columns = labels(raw.columns, 50, "Column");
      if ("error" in columns) return columns;
      return {
        item: {
          ...q,
          type: raw.type,
          rows,
          columns,
          ...flag("requireEachRow", raw.requireEachRow),
          ...flag("onePerColumn", raw.onePerColumn),
          ...flag("shuffleRows", raw.shuffleRows),
        },
      };
    }
    case "date":
      return { item: { ...q, type: "date", includeYear: raw.includeYear !== false, includeTime: raw.includeTime === true } };
    case "time":
      return { item: { ...q, type: "time", duration: raw.duration === true } };
    case "section": {
      const to = goTo(raw.goTo, sections);
      if (typeof to !== "string") return { error: `the “after the previous section” step ${to.error}` };
      return { item: { ...base, type: "section", ...(to === "next" ? {} : { goTo: to }) } };
    }
    case "text":
      return { item: { ...base, type: "text" } };
    case "image": {
      const url = str(raw.url, 2000);
      if (!isHttpUrl(url)) return { error: "paste the image's full http(s) URL" };
      const alt = optStr(raw.alt, 300);
      return { item: { ...base, type: "image", url, ...(alt ? { alt } : {}) } };
    }
    case "video": {
      const url = str(raw.url, 2000);
      if (!youtubeId(url)) return { error: "paste a YouTube video link" };
      return { item: { ...base, type: "video", url } };
    }
    default:
      return { error: "unknown item type" };
  }
}

const itemName = (raw: unknown, index: number) => {
  const title = isObject(raw) ? str(raw.title, 40) : "";
  return `Item ${index + 1}${title ? ` (“${title}”)` : ""}`;
};

/**
 * Strictly reshapes untrusted builder items into FormItem[]: unknown keys dropped, numbers
 * clamped to their allowed ranges, strings trimmed and capped, ids unique, every goTo is
 * "next", "submit" or an existing section. Anything it can't repair is an error naming the item.
 */
export function normalizeItems(raw: unknown): FormItem[] | NormalizeError {
  if (!Array.isArray(raw)) return { error: "The questions didn't arrive as a list." };
  if (raw.length > MAX_ITEMS) return { error: `A form can have at most ${MAX_ITEMS} items.` };
  const ids = new Set<string>();
  for (const [index, item] of raw.entries()) {
    if (!isObject(item) || typeof item.id !== "string" || !ID_PATTERN.test(item.id)) {
      return { error: `${itemName(item, index)} has no valid id.`, index };
    }
    if (ids.has(item.id)) return { error: `${itemName(item, index)} repeats another item's id.`, index };
    ids.add(item.id);
  }
  const sections = new Set((raw as Raw[]).filter((i) => i.type === "section").map((i) => i.id as string));
  const out: FormItem[] = [];
  for (const [index, item] of (raw as Raw[]).entries()) {
    const result = normalizeItem(item, sections);
    if ("error" in result) return { error: `${itemName(item, index)}: ${result.error}.`, index };
    out.push(result.item);
  }
  return out;
}

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** FormSettings from the Settings tab's fields, validated. */
export function parseSettings(form: FormData): { settings: FormSettings } | { error: string } {
  const text = (name: string, max: number) => str(form.get(name), max);
  const checked = (name: string) => form.get(name) === "on";

  const collectEmail = text("collectEmail", 20);
  const sendCopy = text("sendCopy", 20);
  if (!["none", "verified", "input"].includes(collectEmail)) return { error: "Choose how to collect email addresses." };
  if (!["off", "always", "request"].includes(sendCopy)) return { error: "Choose whether to send respondents a copy." };
  if (sendCopy !== "off" && collectEmail === "none") {
    return { error: "Sending respondents a copy needs their email address: turn on Collect email addresses." };
  }

  const notifyEmails = [...new Set(text("notifyEmails", 2000).toLowerCase().split(/[\s,;]+/).filter(Boolean))];
  const badEmail = notifyEmails.find((e) => !EMAIL_PATTERN.test(e));
  if (badEmail) return { error: `“${badEmail}” is not an email address.` };
  if (notifyEmails.length > 20) return { error: "Notify at most 20 email addresses." };

  const color = text("color", 7);
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { error: "Pick an accent colour." };
  const headerImage = text("headerImage", 2000);
  if (headerImage && !isHttpUrl(headerImage)) return { error: "Header image must be a full http(s) URL." };

  return {
    settings: {
      collectEmail: collectEmail as FormSettings["collectEmail"],
      requireSignIn: checked("requireSignIn"),
      limitOne: checked("limitOne"),
      allowEdit: checked("allowEdit"),
      sendCopy: sendCopy as FormSettings["sendCopy"],
      showProgress: checked("showProgress"),
      shuffle: checked("shuffle"),
      confirmation: text("confirmation", 1000) || defaultSettings.confirmation,
      showSubmitAnother: checked("showSubmitAnother"),
      closedMessage: text("closedMessage", 1000) || defaultSettings.closedMessage,
      notifyEmails,
      theme: { color: color.toLowerCase(), ...(headerImage ? { headerImage } : {}) },
    },
  };
}

/** Storage keys of every uploaded file in a response's answers (FormFile[] values). */
export const formFileKeys = (answers: Answers): string[] =>
  Object.values(answers).flatMap((answer) =>
    Array.isArray(answer) ? answer.flatMap((f) => (isObject(f) && typeof f.key === "string" ? [f.key] : [])) : [],
  );

// --- Builder edits ---------------------------------------------------------------

const newId = () => crypto.randomUUID();

/** A fresh item of `type`, with Google's defaults. */
export function blankItem(type: FormItemType, id = newId()): FormItem {
  const q = { id, title: "", required: false };
  switch (type) {
    case "short":
    case "paragraph":
      return { ...q, type };
    case "choice":
    case "checkboxes":
    case "dropdown":
      return { ...q, type, options: [{ label: "Option 1" }] };
    case "file":
      return { ...q, type, maxFiles: 1, maxSizeMb: 10 };
    case "scale":
      return { ...q, type, min: 1, max: 5 };
    case "rating":
      return { ...q, type, max: 5, icon: "star" };
    case "choiceGrid":
    case "checkboxGrid":
      return { ...q, type, rows: ["Row 1"], columns: ["Column 1"] };
    case "date":
      return { ...q, type, includeYear: true, includeTime: false };
    case "time":
      return { ...q, type, duration: false };
    case "section":
    case "text":
      return { id, title: "", type };
    case "image":
    case "video":
      return { id, title: "", type, url: "" };
  }
}

const optionTypes: FormItemType[] = ["choice", "checkboxes", "dropdown"];

/** `item` as another question type: keeps id, title, description, required, and options when both have them. */
export function changeType(item: FormItem, type: FormItemType): FormItem {
  if (item.type === type) return item;
  const next = blankItem(type, item.id) as FormItem & { required?: boolean };
  next.title = item.title;
  if (item.description !== undefined) next.description = item.description;
  if (isQuestion(item) && "required" in next) next.required = item.required ?? false;
  if ("options" in item && "options" in next) {
    // Branch targets only mean something on choice/dropdown with branching on.
    next.options = item.options.map(({ label }) => ({ label }));
    if ("other" in item && item.other && (type === "choice" || type === "checkboxes")) (next as { other?: boolean }).other = true;
  }
  return next;
}

export const hasOptions = (type: FormItemType) => optionTypes.includes(type);

/** A deep copy with a new id. */
export const duplicateItem = (item: FormItem): FormItem => ({ ...structuredClone(item), id: newId() });

/** Items without `id`, and with every goTo that pointed at it reset to "next". */
export function removeItem(items: FormItem[], id: string): FormItem[] {
  const clear = (to: GoTo | undefined) => (to === id ? undefined : to);
  return items
    .filter((i) => i.id !== id)
    .map((i) => {
      if (i.type === "section" && i.goTo === id) return { ...i, goTo: undefined };
      if ((i.type === "choice" || i.type === "dropdown") && i.options.some((o) => o.goTo === id)) {
        return { ...i, options: i.options.map((o) => ({ ...o, goTo: clear(o.goTo) })) };
      }
      return i;
    });
}

export const copyTitle = (title: string) => `Copy of ${title}`.slice(0, 300);
