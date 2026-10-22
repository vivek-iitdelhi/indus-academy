// The shape of a form and its responses: shared by the builder (/admin/forms), the public
// form (/forms/<slug>) and the responses views. Stored as jsonb on forms.items / forms.settings
// / form_responses.answers. Modelled on Google Forms. No imports: safe in client components
// and in node tests.

/** Where to go after a page: the next page, a section (by its item id), or submit. */
export type GoTo = "next" | "submit" | string;

type Base = { id: string; title: string; description?: string };
type Question = Base & { required?: boolean };

export type TextValidation =
  | { kind: "number"; op: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "between" | "notBetween" | "isNumber" | "whole"; a?: number; b?: number; message?: string }
  | { kind: "text"; op: "contains" | "notContains" | "email" | "url"; value?: string; message?: string }
  | LengthValidation
  | RegexValidation;
export type LengthValidation = { kind: "length"; op: "max" | "min"; n: number; message?: string };
export type RegexValidation = { kind: "regex"; op: "contains" | "notContains" | "matches" | "notMatches"; pattern: string; message?: string };
export type CheckboxValidation = { op: "atLeast" | "atMost" | "exactly"; n: number; message?: string };

export type ChoiceOption = { label: string; /** used only when the question's `branching` is on */ goTo?: GoTo };

export const fileKinds = ["document", "spreadsheet", "pdf", "video", "presentation", "drawing", "image", "audio"] as const;
export type FileKind = (typeof fileKinds)[number];

export type FormItem =
  // Questions
  | (Question & { type: "short"; validation?: TextValidation })
  | (Question & { type: "paragraph"; validation?: LengthValidation | RegexValidation })
  | (Question & { type: "choice"; options: ChoiceOption[]; other?: boolean; shuffle?: boolean; branching?: boolean })
  | (Question & { type: "dropdown"; options: ChoiceOption[]; shuffle?: boolean; branching?: boolean })
  | (Question & { type: "checkboxes"; options: ChoiceOption[]; other?: boolean; shuffle?: boolean; validation?: CheckboxValidation })
  | (Question & { type: "file"; maxFiles: 1 | 5 | 10; maxSizeMb: 1 | 10 | 100; accept?: FileKind[] })
  | (Question & { type: "scale"; min: 0 | 1; max: number /* 2–10 */; minLabel?: string; maxLabel?: string })
  | (Question & { type: "rating"; max: number /* 3–10 */; icon: "star" | "heart" | "thumb" })
  | (Question & { type: "choiceGrid" | "checkboxGrid"; rows: string[]; columns: string[]; requireEachRow?: boolean; onePerColumn?: boolean; shuffleRows?: boolean })
  | (Question & { type: "date"; includeYear: boolean; includeTime: boolean })
  | (Question & { type: "time"; duration: boolean })
  // Layout. A section starts a new page; like a Google Forms page break, its `goTo` is where
  // respondents go after finishing the page BEFORE it (default "next" = this section).
  | (Base & { type: "section"; goTo?: GoTo })
  | (Base & { type: "text" })
  | (Base & { type: "image"; url: string; alt?: string })
  | (Base & { type: "video"; url: string /* YouTube link */ });

export type FormItemType = FormItem["type"];
export type QuestionItem = Exclude<FormItem, { type: "section" | "text" | "image" | "video" }>;
export const layoutTypes = ["section", "text", "image", "video"] as const;
export const isQuestion = (item: FormItem): item is QuestionItem => !(layoutTypes as readonly string[]).includes(item.type);

/** Labels in the builder's type picker, in Google's order. */
export const itemTypeLabels: Record<FormItemType, string> = {
  short: "Short answer",
  paragraph: "Paragraph",
  choice: "Multiple choice",
  checkboxes: "Checkboxes",
  dropdown: "Dropdown",
  file: "File upload",
  scale: "Linear scale",
  rating: "Rating",
  choiceGrid: "Multiple choice grid",
  checkboxGrid: "Tick box grid",
  date: "Date",
  time: "Time",
  section: "Section",
  text: "Title and description",
  image: "Image",
  video: "Video",
};

export type FormFile = { key: string; name: string; size: number; type: string };

/**
 * One answer, by question type:
 * short, paragraph, dropdown → string · choice → string (an option label, or the "Other" text)
 * checkboxes → string[] (labels, plus at most one "Other" text) · scale, rating → number
 * choiceGrid → Record<row, column> · checkboxGrid → Record<row, column[]>
 * date → "YYYY-MM-DD" | "MM-DD" (no year), with "THH:mm" appended when includeTime
 * time → "HH:mm" | duration "HH:mm:ss" · file → FormFile[]
 */
export type Answer = string | string[] | number | Record<string, string> | Record<string, string[]> | FormFile[];
/** Keyed by question item id. Unanswered questions are absent. */
export type Answers = Record<string, Answer>;

export type FormSettings = {
  /** none, from the signed-in account ("verified"), or typed by the respondent ("input"). */
  collectEmail: "none" | "verified" | "input";
  /** Respondents must sign in. Forced on by collectEmail "verified", limitOne, allowEdit and file questions. */
  requireSignIn: boolean;
  limitOne: boolean;
  /** Respondents can change their response after submitting (needs sign-in). */
  allowEdit: boolean;
  /** Email respondents a copy of their response: never, always, or if they tick the box. */
  sendCopy: "off" | "always" | "request";
  showProgress: boolean;
  /** Shuffle question order within each section. */
  shuffle: boolean;
  confirmation: string;
  showSubmitAnother: boolean;
  /** Shown instead of the form while it is not accepting responses. */
  closedMessage: string;
  /** Admins emailed on every new response. */
  notifyEmails: string[];
  /** Header accent colour (hex) and optional header image URL. */
  theme: { color: string; headerImage?: string };
};

export const defaultSettings: FormSettings = {
  collectEmail: "none",
  requireSignIn: false,
  limitOne: false,
  allowEdit: false,
  sendCopy: "off",
  showProgress: false,
  shuffle: false,
  confirmation: "Your response has been recorded.",
  showSubmitAnother: true,
  closedMessage: "This form is no longer accepting responses.",
  notifyEmails: [],
  theme: { color: "#0f5d4a" },
};

/** Whether respondents must sign in, after the settings and questions that force it. */
export const needsSignIn = (settings: FormSettings, items: FormItem[]) =>
  settings.requireSignIn ||
  settings.collectEmail === "verified" ||
  settings.limitOne ||
  settings.allowEdit ||
  items.some((item) => item.type === "file");
