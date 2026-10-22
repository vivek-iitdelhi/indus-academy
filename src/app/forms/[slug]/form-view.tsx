"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  acceptAttribute,
  checkResponse,
  EMAIL_FIELD,
  fileAccepted,
  formatAnswer,
  isEmail,
  nextPage,
  pages,
  pathFrom,
  prefillQuery,
  REQUIRED,
  validateAnswer,
  youTubeId,
} from "@/lib/forms/logic";
import { isQuestion, type Answer, type Answers, type FormFile, type FormItem, type FormSettings, type QuestionItem } from "@/lib/forms/types";
import { submitForm } from "./actions";
import { ResponseCard, Ring, type CardLine } from "./response-card";
import "./form.css";

export type Mode = "live" | "preview" | "prefill";

type Update = (next: Answer | undefined | ((prev: Answer | undefined) => Answer | undefined)) => void;
type FieldProps<T extends QuestionItem["type"]> = {
  item: Extract<QuestionItem, { type: T }>;
  value: Answer | undefined;
  update: Update;
  aria: { "aria-labelledby": string; "aria-describedby"?: string; "aria-invalid"?: boolean; "aria-required"?: boolean };
};

// --- Look -----------------------------------------------------------------------

// Motion lives in form.css (fm-* classes): see the comment at its top.
const card = "fm-card rounded-2xl border bg-white p-5 sm:p-7";
const lineInput =
  "block w-full border-0 border-b border-line bg-transparent px-0 py-2.5 text-[1.05rem] text-ink placeholder:text-muted/60 focus:outline-none aria-[invalid=true]:border-red-600";
const boxInput =
  "min-h-11 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-ink focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20";
const tick = "fm-tick size-5 shrink-0 accent-[var(--accent)]";
/** A full-width tappable row for one option; tinted while chosen. */
const optionRow =
  "-mx-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-paper has-[:checked]:bg-[color-mix(in_srgb,var(--accent)_8%,white)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-saffron";
const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 text-sm font-medium text-white transition-[filter] duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:opacity-60";
const secondaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-6 text-sm font-medium text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron";
const textButton = "rounded-full px-3 py-2 text-sm font-medium text-muted hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-saffron";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The underline that draws in on focus wraps the field (inputs can't carry pseudo-elements). */
function Line({ className = "", children }: { className?: string; children: ReactNode }) {
  return <span className={`fm-line ${className}`}>{children}</span>;
}

const arrow = (
  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const safeColor = (c: string | undefined) => (c && /^#[0-9a-f]{3,8}$/i.test(c) ? c : "#0f5d4a");

/** The centred column, accent colour and optional header image. Used by every state of the page. */
export function FormColumn({ settings, wide = false, children }: { settings: FormSettings; wide?: boolean; children: ReactNode }) {
  const image = settings.theme?.headerImage;
  return (
    // `wide`: room on the right for the response card on xl screens, so form + card sit centred together.
    <div className={`mx-auto w-full max-w-[680px] px-3 pt-6 pb-28 sm:pt-12 xl:pb-16 ${wide ? "xl:max-w-[1064px] xl:pr-[23.5rem]" : ""}`} style={{ "--accent": safeColor(settings.theme?.color) } as CSSProperties}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL on any host
        <img src={image} alt="" className="mb-3 aspect-[4/1] w-full rounded-2xl object-cover" />
      )}
      <div className="space-y-3">{children}</div>
      <p className="mt-8 text-center text-xs text-muted">Never submit passwords through this form.</p>
    </div>
  );
}

/** The title card: accent bar that draws in, title, and whatever goes under it. */
export function TitleCard({ title, eyebrow, children }: { title: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="fm-bar h-2 bg-[var(--accent)]" />
      <div className="fm-rise p-5 sm:p-8">
        <p className="inline-flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted">
          <span className="size-1.5 rounded-full bg-saffron" aria-hidden="true" />
          <span className={eyebrow ? "hidden sm:inline" : ""}>Indus AI Academy{eyebrow ? " · " : ""}</span>
          {eyebrow}
        </p>
        <h1 className="mt-4 overflow-visible pb-[0.1em] text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-balance sm:text-[2.6rem]">{title}</h1>
        {children}
      </div>
    </div>
  );
}

// --- Shuffling (seeded on the server, so server and client render the same order) --------

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rand: () => number) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pages as displayed: questions and options shuffled where the form asks for it. */
function displayPages(items: FormItem[], settings: FormSettings, seed: number) {
  const rand = random(seed);
  const shown = items.map((item): FormItem => {
    if ("options" in item && "shuffle" in item && item.shuffle) return { ...item, options: shuffle(item.options, rand) };
    if ((item.type === "choiceGrid" || item.type === "checkboxGrid") && item.shuffleRows) return { ...item, rows: shuffle(item.rows, rand) };
    return item;
  });
  return pages(shown).map((page) => {
    if (!settings.shuffle) return page;
    const head = page[0]?.type === "section" ? [page[0]] : [];
    return [...head, ...shuffle(page.slice(head.length), rand)];
  });
}

// --- The form ---------------------------------------------------------------------

export function FormView(props: {
  slug: string;
  title: string;
  description: string;
  items: FormItem[];
  settings: FormSettings;
  mode: Mode;
  /** The signed-in account's email, if any. */
  userEmail: string | null;
  initialAnswers: Answers;
  initialEmail: string;
  editing: boolean;
  seed: number;
}) {
  const { slug, title, description, items, settings, mode, userEmail } = props;
  const view = useMemo(() => displayPages(items, settings, props.seed), [items, settings, props.seed]);
  const raw = useMemo(() => pages(items), [items]);
  const byId = useMemo(() => new Map(items.filter(isQuestion).map((item) => [item.id, item])), [items]);

  const [answers, setAnswers] = useState<Answers>(props.initialAnswers);
  const [history, setHistory] = useState<number[]>([0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState(props.initialEmail);
  const [wantCopy, setWantCopy] = useState(false);
  const [editing, setEditing] = useState(props.editing);
  const [status, setStatus] = useState<"filling" | "sending" | "done">("filling");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [uploads, setUploads] = useState(0);
  const [link, setLink] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  // The question being typed into: its card keeps the answer it had until the field is left,
  // then the new one is inked in. `typing` also tucks the bottom bar away for the keyboard.
  const [focused, setFocused] = useState<{ id: string; before: string; typing: boolean } | null>(null);
  // Scroll/focus requests, handled after render. A new object each time, so repeats still fire.
  const [focus, setFocus] = useState<{ id: string } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const [date] = useState(() => new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }));

  useEffect(() => {
    if (!focus) return;
    const el = focus.id === "top" ? top.current : document.getElementById(`item-${focus.id}`);
    el?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: focus.id === "top" ? "start" : "center" });
    if (focus.id !== "top") el?.querySelector<HTMLElement>("input:not([type=hidden]):not([tabindex='-1']), textarea, select, button")?.focus({ preventScroll: true });
  }, [focus]);

  const current = history[history.length - 1];
  const next = nextPage(items, current, answers);
  const askEmail = settings.collectEmail === "input";
  const copyBox = settings.sendCopy === "request" && (askEmail || Boolean(userEmail));

  // Questions on the path the answers so far lead along: what the progress and the card count.
  const path = [...history.slice(0, -1), ...pathFrom(items, current, answers)];
  const asked = path.flatMap((page) => raw[page].filter(isQuestion));
  const answered = asked.filter((item) => answers[item.id] !== undefined).length;
  const cardText = (item: QuestionItem) =>
    focused?.id === item.id && (item.type === "short" || item.type === "paragraph") ? focused.before : formatAnswer(item, answers[item.id]);
  const heroItem = asked.find((item) => item.type === "short");
  const hero: CardLine | undefined = heroItem && { id: heroItem.id, label: heroItem.title, value: cardText(heroItem) };
  const lines: CardLine[] = asked
    .filter((item) => item !== heroItem && cardTypes.has(item.type))
    .slice(0, 6)
    .map((item) => ({ id: item.id, label: item.title, value: cardText(item) }));
  const cardProps = { formTitle: title, hero, lines, done: answered, total: asked.length, date };

  const update = (id: string): Update => (value) => {
    setAnswers((prev) => {
      const v = typeof value === "function" ? value(prev[id]) : value;
      const out = { ...prev };
      if (v === undefined) delete out[id];
      else out[id] = v;
      return out;
    });
    setErrors((prev) => {
      if (!(id in prev)) return prev;
      const out = { ...prev };
      delete out[id];
      return out;
    });
  };

  /** A small sideways nudge on the cards that need attention. */
  const nudge = (ids: string[]) => {
    if (reducedMotion()) return;
    requestAnimationFrame(() => {
      for (const id of ids) {
        document.getElementById(`item-${id}`)?.animate(
          [{ transform: "none" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-2px)" }, { transform: "none" }],
          { duration: 340, easing: "cubic-bezier(0.2, 0, 0, 1)" },
        );
      }
    });
  };

  /** Validates the page on screen; shows and focuses the first error. */
  const checkPage = () => {
    if (mode === "prefill") return true;
    const found: Record<string, string> = {};
    if (current === 0 && askEmail) {
      const e = email.trim();
      if (!e) found[EMAIL_FIELD] = REQUIRED;
      else if (!isEmail(e)) found[EMAIL_FIELD] = "Must be a valid email";
    }
    for (const item of raw[current]) {
      if (!isQuestion(item)) continue;
      const error = validateAnswer(item, answers[item.id]);
      if (error) found[item.id] = error;
    }
    setErrors(found);
    const first = [EMAIL_FIELD, ...view[current].map((i) => i.id)].find((id) => id in found);
    if (first) {
      setFocus({ id: first });
      nudge(Object.keys(found));
    }
    return !first;
  };

  /** Moves between sections; the questions slide forwards or back where the browser can. */
  const turn = (dir: "forward" | "back", change: () => void) => {
    if (!document.startViewTransition || reducedMotion()) {
      change();
      setFocus({ id: "top" });
      return;
    }
    const root = document.documentElement;
    root.dataset.fmDir = dir;
    const transition = document.startViewTransition(() => {
      flushSync(change);
      top.current?.scrollIntoView({ block: "start" });
    });
    transition.finished.finally(() => delete root.dataset.fmDir);
  };

  const goNext = () => {
    if (next === "submit" || !checkPage()) return;
    turn("forward", () => {
      setMessage(null);
      setHistory([...history, next]);
    });
  };

  const goBack = () => {
    turn("back", () => {
      setErrors({});
      setMessage(null);
      setHistory(history.slice(0, -1));
    });
  };

  const submit = async () => {
    if (!checkPage()) return;
    if (uploads > 0) return setMessage("Wait for your files to finish uploading.");
    setStatus("sending");
    setMessage(null);
    let result: Awaited<ReturnType<typeof submitForm>>;
    try {
      result = await submitForm(slug, {
        answers: checkResponse(items, answers).answers,
        email,
        sendCopy: wantCopy,
        edit: editing,
        preview: mode === "preview",
      });
    } catch {
      result = { ok: false, error: "We couldn't send your response. Check your connection and try again." };
    }
    if (result.ok) {
      setReference(result.ref);
      setStatus("done");
      setFocus({ id: "top" });
      return;
    }
    setStatus("filling");
    setMessage(result.error);
    const fieldErrors = result.fieldErrors ?? {};
    setErrors(fieldErrors);
    // Go back to the earliest visited page with an error.
    const at = history.findIndex((page) => (page === 0 && EMAIL_FIELD in fieldErrors) || raw[page].some((item) => item.id in fieldErrors));
    if (at >= 0) {
      setHistory(history.slice(0, at + 1));
      const page = history[at];
      setFocus({ id: [EMAIL_FIELD, ...view[page].map((i) => i.id)].find((id) => id in fieldErrors)! });
      nudge(Object.keys(fieldErrors));
    }
  };

  const reset = (to: Answers) => {
    setAnswers(to);
    setHistory([0]);
    setErrors({});
    setMessage(null);
    setLink(null);
    setResetKey((k) => k + 1);
    setFocus({ id: "top" });
  };

  const clearForm = () => {
    if (!window.confirm("Clear form? This will remove your answers from all questions and cannot be undone.")) return;
    if (askEmail) setEmail("");
    setWantCopy(false);
    reset({});
  };

  const getLink = () => {
    const query = prefillQuery(items, checkResponse(items, answers).answers);
    setLink(`${window.location.origin}/forms/${slug}?usp=pp_url${query ? `&${query}` : ""}`);
  };

  if (status === "done") {
    const stamp = mode === "preview" ? "PREVIEW" : `REF ${reference}`;
    return (
      <div ref={top} className="relative scroll-mt-24 space-y-3 xl:min-h-[38rem]">
        {/* The card stays where it filled in (beside the form on xl) and is stamped there. */}
        <div className="fm-card-in pb-2 xl:hidden">
          <ResponseCard {...cardProps} stamp={stamp} />
        </div>
        <aside className="absolute inset-y-0 left-full ml-10 hidden w-[19rem] xl:block">
          <div className="sticky top-[calc(var(--fm-top)+2rem)]">
            <ResponseCard {...cardProps} stamp={stamp} />
          </div>
        </aside>
        <TitleCard title={mode === "preview" ? "Preview complete" : editing ? "Response updated" : "You're in the register"}>
          <p className="mt-4 whitespace-pre-wrap leading-relaxed text-ink/85">{settings.confirmation || "Your response has been recorded."}</p>
          {mode === "preview" ? (
            <p className="mt-3 text-sm text-muted">This was a preview, so the response was not saved.</p>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Reference <span className="font-mono font-medium text-ink">{reference}</span> · {date}. A screenshot of this page is your proof of submission.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {settings.showSubmitAnother && !settings.limitOne && (
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  setEditing(false);
                  setStatus("filling");
                  reset({});
                }}
              >
                Submit another response
              </button>
            )}
            {settings.allowEdit && mode === "live" && (
              <a href={`/forms/${slug}?edit=1`} className={secondaryButton}>
                Edit your response
              </a>
            )}
          </div>
        </TitleCard>
      </div>
    );
  }

  const remaining = pathFrom(items, current, answers).length;
  const total = history.length - 1 + remaining;
  const hasRequired = items.some((i) => isQuestion(i) && i.required) || askEmail;
  const questionCount = items.filter(isQuestion).length;

  return (
    <div
      ref={top}
      className="relative scroll-mt-24"
      onFocus={(e) => {
        const id = (e.target as HTMLElement).closest<HTMLElement>("[data-item]")?.dataset.item;
        const item = id ? byId.get(id) : undefined;
        const typing = (e.target as HTMLElement).matches("input:not([type=radio]):not([type=checkbox]):not([type=file]), textarea");
        if (focused?.id === id && focused?.typing === typing) return;
        setFocused(item ? { id: item.id, before: focused?.id === item.id ? focused.before : formatAnswer(item, answers[item.id]), typing } : typing ? { id: "", before: "", typing } : null);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(null);
      }}
    >
      {/* Answered so far, along the top under the site header. */}
      <div className="pointer-events-none fixed inset-x-0 top-[var(--fm-top)] z-40 h-[3px] bg-transparent" aria-hidden="true">
        <div className="fm-progress h-full bg-[var(--accent)]" style={{ transform: `scaleX(${asked.length ? answered / asked.length : 0})` }} />
      </div>

      <div className="space-y-3">
        <TitleCard title={title} eyebrow={`${questionCount} question${questionCount === 1 ? "" : "s"}${raw.length > 1 ? ` · ${raw.length} sections` : ""}`}>
          {current === 0 && description && <p className="mt-4 max-w-[58ch] whitespace-pre-wrap text-[1.05rem] leading-relaxed text-ink/75">{description}</p>}
          {(settings.collectEmail === "verified" && userEmail) || editing || hasRequired ? (
            <div className="mt-6 space-y-1 border-t border-line pt-4 text-sm">
              {settings.collectEmail === "verified" && userEmail && (
                <p className="text-muted">
                  Recording <span className="font-medium text-ink">{userEmail}</span> with your response
                </p>
              )}
              {editing && <p className="text-muted">You&apos;re editing the response you submitted earlier.</p>}
              {hasRequired && (
                <p className="text-muted">
                  <span className="text-red-700">*</span> Required
                </p>
              )}
            </div>
          ) : null}
        </TitleCard>

        <div className="space-y-3" style={{ viewTransitionName: "fm-page" }}>
          {current === 0 && (askEmail || copyBox) && (
            <div id={`item-${EMAIL_FIELD}`} className={`${card} ${errors[EMAIL_FIELD] ? "border-red-600" : "border-line"}`} data-invalid={errors[EMAIL_FIELD] ? "" : undefined}>
              {askEmail && (
                <>
                  <label htmlFor="respondent-email" className="block text-[1.05rem] font-medium">
                    Email<span className="text-red-700" aria-hidden="true"> *</span>
                  </label>
                  <Line className="mt-3 sm:max-w-sm">
                    <input
                      id="respondent-email"
                      type="email"
                      autoComplete="email"
                      placeholder="Your email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrors((prev) => {
                          const out = { ...prev };
                          delete out[EMAIL_FIELD];
                          return out;
                        });
                      }}
                      aria-required
                      aria-invalid={Boolean(errors[EMAIL_FIELD]) || undefined}
                      aria-describedby={errors[EMAIL_FIELD] ? `${EMAIL_FIELD}-error` : undefined}
                      className={lineInput}
                    />
                  </Line>
                  <ErrorText id={EMAIL_FIELD} error={errors[EMAIL_FIELD]} />
                </>
              )}
              {copyBox && (
                <label className={`${optionRow} text-sm ${askEmail ? "mt-4" : ""}`}>
                  <input type="checkbox" className={tick} checked={wantCopy} onChange={(e) => setWantCopy(e.target.checked)} />
                  Send me a copy of my responses{!askEmail && userEmail ? ` (${userEmail})` : ""}
                </label>
              )}
            </div>
          )}

          {view[current].map((item) => (
            <Item key={`${item.id}-${resetKey}`} item={item} slug={slug} mode={mode} answers={answers} errors={errors} update={update} onUploads={setUploads} />
          ))}
        </div>

        {message && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {message}
          </p>
        )}

        {link && (
          <div className={`${card} border-line`}>
            <label htmlFor="prefill-link" className="block text-sm font-medium">
              Pre-filled link
            </label>
            <div className="mt-2 flex gap-2">
              <input id="prefill-link" readOnly value={link} onFocus={(e) => e.target.select()} className={`min-w-0 flex-1 text-sm ${boxInput}`} />
              <CopyButton text={link} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-3">
          <div className="flex gap-3">
            {history.length > 1 && (
              <button type="button" className={secondaryButton} onClick={goBack}>
                Back
              </button>
            )}
            {next !== "submit" ? (
              <button type="button" className={mode === "prefill" ? secondaryButton : primaryButton} onClick={goNext}>
                Next {arrow}
              </button>
            ) : mode !== "prefill" ? (
              <button type="button" className={primaryButton} onClick={submit} disabled={status === "sending"}>
                {status === "sending" ? "Submitting…" : <>Submit {arrow}</>}
              </button>
            ) : null}
            {mode === "prefill" && (
              <button type="button" className={primaryButton} onClick={getLink}>
                Get link
              </button>
            )}
          </div>
          {settings.showProgress && total > 1 && (
            <p className="flex-1 text-xs text-muted sm:text-center" role="status">
              Section {history.length} of {total}
            </p>
          )}
          <button type="button" className={`ml-auto ${textButton}`} onClick={clearForm}>
            Clear form
          </button>
        </div>
      </div>

      {/* Wide screens: the card rides beside the form. */}
      <aside className="absolute inset-y-0 left-full ml-10 hidden w-[19rem] xl:block" aria-label="Your answers so far">
        <div className="sticky top-[calc(var(--fm-top)+2rem)]">
          <ResponseCard {...cardProps} />
          <p className="mt-3 px-1 text-xs leading-relaxed text-muted">Your answers are written onto this card as you go. Check them before you submit.</p>
        </div>
      </aside>

      {/* Narrower screens: a slim bar with the count, out of the way while typing. */}
      <div
        className="fm-dock fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur xl:hidden"
        data-hidden={focused?.typing ? "" : undefined}
      >
        <div className="mx-auto flex max-w-[680px] items-center gap-3 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Ring done={answered} total={asked.length} size={30} />
          <p className="text-sm">
            <span className="font-medium">
              {answered} of {asked.length}
            </span>{" "}
            <span className="text-muted">answered</span>
          </p>
          {total > 1 && (
            <p className="ml-auto font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
              Section {history.length}/{total}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Question types whose answer reads well as one line on the response card. */
const cardTypes = new Set<string>(["short", "choice", "dropdown", "checkboxes", "date", "time", "scale", "rating"]);

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={secondaryButton}
      onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => setCopied(false))}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="mt-3 flex items-center gap-2 text-sm text-red-700">
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
      </svg>
      {error}
    </p>
  );
}

// --- One item ---------------------------------------------------------------------

function Item({
  item,
  slug,
  mode,
  answers,
  errors,
  update,
  onUploads,
}: {
  item: FormItem;
  slug: string;
  mode: Mode;
  answers: Answers;
  errors: Record<string, string>;
  update: (id: string) => Update;
  onUploads: (fn: (n: number) => number) => void;
}) {
  const id = item.id;
  const descriptionId = item.description ? `${id}-desc` : undefined;
  const description = item.description && (
    <p id={descriptionId} className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">
      {item.description}
    </p>
  );

  if (item.type === "section") {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="h-1.5 bg-[var(--accent)]" />
        <div className="p-5 sm:p-7">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted">Section</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{item.title}</h2>
          {description}
        </div>
      </div>
    );
  }
  if (item.type === "text") {
    return (
      <div className={`${card} border-line`}>
        <h2 className="text-lg font-semibold">{item.title}</h2>
        {description}
      </div>
    );
  }
  if (item.type === "image") {
    return (
      <figure className={`${card} border-line`}>
        {item.title && <h2 className="mb-3 font-medium">{item.title}</h2>}
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL on any host */}
        <img src={item.url} alt={item.alt ?? item.title ?? ""} className="max-h-[480px] w-auto max-w-full rounded-lg" loading="lazy" />
        {item.description && <figcaption className="mt-2 whitespace-pre-wrap text-sm text-muted">{item.description}</figcaption>}
      </figure>
    );
  }
  if (item.type === "video") {
    const video = youTubeId(item.url);
    return (
      <div className={`${card} border-line`}>
        {item.title && <h2 className="mb-3 font-medium">{item.title}</h2>}
        {video ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video}`}
            title={item.title || "Video"}
            className="aspect-video w-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <a href={item.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
            Watch the video
          </a>
        )}
        {description}
      </div>
    );
  }

  const error = errors[id];
  const labelId = `${id}-label`;
  const aria = {
    "aria-labelledby": labelId,
    "aria-describedby": [descriptionId, error && `${id}-error`].filter(Boolean).join(" ") || undefined,
    "aria-invalid": error ? true : undefined,
    "aria-required": item.required || undefined,
  };
  const field = { value: answers[id], update: update(id), aria };

  return (
    <div id={`item-${id}`} data-item={id} data-invalid={error ? "" : undefined} className={`${card} scroll-mt-24 ${error ? "border-red-600" : "border-line"}`}>
      <div id={labelId} className="text-[1.05rem] font-medium leading-snug">
        {item.title || "Untitled question"}
        {item.required && (
          <span className="text-red-700" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </div>
      {description}
      <div className="mt-4">
        {item.type === "short" && <ShortField item={item} {...field} />}
        {item.type === "paragraph" && <ParagraphField item={item} {...field} />}
        {item.type === "choice" && <ChoiceField item={item} {...field} />}
        {item.type === "checkboxes" && <CheckboxesField item={item} {...field} />}
        {item.type === "dropdown" && <DropdownField item={item} {...field} />}
        {item.type === "scale" && <ScaleField item={item} {...field} />}
        {item.type === "rating" && <RatingField item={item} {...field} />}
        {(item.type === "choiceGrid" || item.type === "checkboxGrid") && <GridField item={item} {...field} />}
        {item.type === "date" && <DateField item={item} {...field} />}
        {item.type === "time" && <TimeField item={item} {...field} />}
        {item.type === "file" && <FileField item={item} {...field} slug={slug} mode={mode} onUploads={onUploads} />}
      </div>
      <ErrorText id={id} error={error} />
    </div>
  );
}

const str = (v: Answer | undefined) => (typeof v === "string" ? v : "");
const orUndefined = (s: string) => (s === "" ? undefined : s);

function ClearSelection({ show, onClear }: { show: boolean; onClear: () => void }) {
  if (!show) return null;
  return (
    <div className="mt-2 flex justify-end">
      <button type="button" className={textButton} onClick={onClear}>
        Clear selection
      </button>
    </div>
  );
}

// --- Fields -----------------------------------------------------------------------

function ShortField({ item, value, update, aria }: FieldProps<"short">) {
  const v = item.validation;
  const inputMode = v?.kind === "number" ? "decimal" : v?.kind === "text" && v.op === "email" ? "email" : v?.kind === "text" && v.op === "url" ? "url" : undefined;
  return (
    <Line className="sm:max-w-md">
      <input
        type="text"
        value={str(value)}
        onChange={(e) => update(orUndefined(e.target.value))}
        inputMode={inputMode}
        placeholder="Your answer"
        className={lineInput}
        {...aria}
      />
    </Line>
  );
}

function ParagraphField({ value, update, aria }: FieldProps<"paragraph">) {
  return (
    <Line>
      <textarea
        value={str(value)}
        onChange={(e) => update(orUndefined(e.target.value))}
        placeholder="Your answer"
        rows={1}
        className={`field-sizing-content min-h-11 resize-none ${lineInput}`}
        {...aria}
      />
    </Line>
  );
}

function ChoiceField({ item, value, update, aria }: FieldProps<"choice">) {
  const labels = item.options.map((o) => o.label);
  const current = str(value);
  const [otherOn, setOtherOn] = useState(current !== "" && !labels.includes(current));
  const [draft, setDraft] = useState(otherOn ? current : "");
  return (
    <div role="radiogroup" {...aria}>
      {labels.map((label) => (
        <label key={label} className={optionRow}>
          <input
            type="radio"
            name={item.id}
            className={tick}
            checked={!otherOn && current === label}
            onChange={() => {
              setOtherOn(false);
              update(label);
            }}
          />
          <span>{label}</span>
        </label>
      ))}
      {item.other && (
        <div className={`${optionRow} cursor-auto`}>
          <input
            type="radio"
            name={item.id}
            className={tick}
            aria-label="Other"
            checked={otherOn}
            onChange={() => {
              setOtherOn(true);
              update(orUndefined(draft));
            }}
          />
          <span aria-hidden="true">Other:</span>
          <Line className="flex-1">
            <input
              type="text"
              aria-label="Other answer"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setOtherOn(true);
                update(orUndefined(e.target.value));
              }}
              className={lineInput}
            />
          </Line>
        </div>
      )}
      <ClearSelection
        show={!item.required && (current !== "" || otherOn)}
        onClear={() => {
          setOtherOn(false);
          update(undefined);
        }}
      />
    </div>
  );
}

function CheckboxesField({ item, value, update, aria }: FieldProps<"checkboxes">) {
  const labels = item.options.map((o) => o.label);
  const list = Array.isArray(value) ? (value as string[]) : [];
  const initialOther = list.find((v) => !labels.includes(v));
  const [otherOn, setOtherOn] = useState(initialOther !== undefined);
  const [draft, setDraft] = useState(initialOther ?? "");
  const chosen = labels.filter((l) => list.includes(l));
  const save = (options: string[], other: boolean, text: string) => {
    const out = [...labels.filter((l) => options.includes(l)), ...(other && text ? [text] : [])];
    update(out.length ? out : undefined);
  };
  return (
    <div role="group" {...aria}>
      {labels.map((label) => (
        <label key={label} className={optionRow}>
          <input
            type="checkbox"
            className={tick}
            checked={chosen.includes(label)}
            onChange={(e) => save(e.target.checked ? [...chosen, label] : chosen.filter((l) => l !== label), otherOn, draft)}
          />
          <span>{label}</span>
        </label>
      ))}
      {item.other && (
        <div className={`${optionRow} cursor-auto`}>
          <input
            type="checkbox"
            className={tick}
            aria-label="Other"
            checked={otherOn}
            onChange={(e) => {
              setOtherOn(e.target.checked);
              save(chosen, e.target.checked, draft);
            }}
          />
          <span aria-hidden="true">Other:</span>
          <Line className="flex-1">
            <input
              type="text"
              aria-label="Other answer"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setOtherOn(true);
                save(chosen, true, e.target.value);
              }}
              className={lineInput}
            />
          </Line>
        </div>
      )}
    </div>
  );
}

function DropdownField({ item, value, update, aria }: FieldProps<"dropdown">) {
  return (
    <select value={str(value)} onChange={(e) => update(orUndefined(e.target.value))} className={`w-full sm:w-auto sm:min-w-60 ${boxInput}`} {...aria}>
      <option value="">Choose</option>
      {item.options.map((o) => (
        <option key={o.label} value={o.label}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

function ScaleField({ item, value, update, aria }: FieldProps<"scale">) {
  return (
    <div role="radiogroup" {...aria}>
      <div className="flex items-end gap-1 overflow-x-auto pb-1 sm:gap-2">
        {item.minLabel && <span className="shrink-0 pb-1 pr-2 text-sm text-muted">{item.minLabel}</span>}
        {range(item.min, item.max).map((n) => (
          <label key={n} className="flex min-w-9 flex-1 cursor-pointer flex-col items-center gap-2 text-sm">
            <span>{n}</span>
            <input type="radio" name={item.id} className={tick} checked={value === n} onChange={() => update(n)} />
          </label>
        ))}
        {item.maxLabel && <span className="shrink-0 pb-1 pl-2 text-sm text-muted">{item.maxLabel}</span>}
      </div>
      <ClearSelection show={!item.required && value !== undefined} onClear={() => update(undefined)} />
    </div>
  );
}

const icons = {
  star: "M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z",
  heart:
    "M12 20.5l-1.38-1.26C5.7 14.8 2.5 11.9 2.5 8.35 2.5 5.45 4.77 3.2 7.65 3.2c1.63 0 3.2.76 4.35 1.96 1.15-1.2 2.72-1.96 4.35-1.96 2.88 0 5.15 2.25 5.15 5.15 0 3.55-3.2 6.45-8.12 10.9L12 20.5z",
  thumb:
    "M2 21h3.5V9.5H2V21zm19.5-10.5c0-1.1-.9-2-2-2h-5.6l.85-4.1.03-.3c0-.4-.17-.8-.44-1.06L13.3 2 7.8 7.5c-.3.3-.5.73-.5 1.2V19c0 1.1.9 2 2 2h8.1c.83 0 1.54-.5 1.84-1.22l2.9-6.76c.08-.23.13-.47.13-.72v-1.8z",
};

function RatingField({ item, value, update, aria }: FieldProps<"rating">) {
  const chosen = typeof value === "number" ? value : 0;
  return (
    <div role="radiogroup" {...aria}>
      <div className="flex flex-wrap gap-1">
        {range(1, item.max).map((n) => (
          <label
            key={n}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-lg p-1.5 text-xs text-muted has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-saffron"
          >
            <input type="radio" name={item.id} className="sr-only" checked={chosen === n} onChange={() => update(n)} aria-label={`${n} of ${item.max}`} />
            <svg viewBox="0 0 24 24" className="size-8 sm:size-9" aria-hidden="true">
              <path
                d={icons[item.icon] ?? icons.star}
                fill={n <= chosen ? "var(--accent)" : "none"}
                stroke={n <= chosen ? "var(--accent)" : "currentColor"}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span aria-hidden="true">{n}</span>
          </label>
        ))}
      </div>
      <ClearSelection show={!item.required && chosen > 0} onClear={() => update(undefined)} />
    </div>
  );
}

function GridField({ item, value, update, aria }: FieldProps<"choiceGrid" | "checkboxGrid">) {
  const multi = item.type === "checkboxGrid";
  const grid = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, string | string[]>;
  const has = (row: string, col: string) => (multi ? ((grid[row] as string[] | undefined) ?? []).includes(col) : grid[row] === col);
  const set = (row: string, col: string, on: boolean) => {
    const out = { ...grid };
    if (multi) {
      const cols = item.columns.filter((c) => (c === col ? on : ((grid[row] as string[] | undefined) ?? []).includes(c)));
      if (cols.length) out[row] = cols;
      else delete out[row];
    } else out[row] = col;
    update(Object.keys(out).length ? (out as Answer) : undefined);
  };
  return (
    <div role="group" {...aria}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr>
              <td />
              {item.columns.map((col) => (
                <th key={col} scope="col" className="px-3 pb-2 text-center font-normal text-muted">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {item.rows.map((row, r) => (
              <tr key={row} className="bg-paper/70">
                <th scope="row" className="max-w-48 rounded-l-lg px-3 py-3 text-left font-normal">
                  {row}
                </th>
                {item.columns.map((col, c) => (
                  <td key={col} className={`px-3 py-3 text-center ${c === item.columns.length - 1 ? "rounded-r-lg" : ""}`}>
                    <input
                      type={multi ? "checkbox" : "radio"}
                      name={`${item.id}-${r}`}
                      className={`${tick} align-middle`}
                      aria-label={`${row}, ${col}`}
                      checked={has(row, col)}
                      onChange={(e) => set(row, col, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ClearSelection show={!multi && !item.required && Object.keys(grid).length > 0} onClear={() => update(undefined)} />
    </div>
  );
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");

function DateField({ item, value, update, aria }: FieldProps<"date">) {
  const [datePart = "", timePart = ""] = str(value).split("T");
  const [month = "", day = ""] = item.includeYear ? [] : datePart.split("-");
  const save = (d: string, t: string) => update(d || t ? (item.includeTime ? `${d}T${t}` : d) : undefined);
  const { "aria-labelledby": labelledBy, ...rest } = aria;
  const label = (what: string) => ({ "aria-label": what, "aria-describedby": [labelledBy, rest["aria-describedby"]].filter(Boolean).join(" "), "aria-invalid": rest["aria-invalid"] });
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap items-end gap-4">
      {item.includeYear ? (
        <input type="date" value={datePart} onChange={(e) => save(e.target.value, timePart)} className={boxInput} {...label("Date")} />
      ) : (
        <>
          <select value={month} onChange={(e) => save(e.target.value || day ? `${e.target.value}-${day}` : "", timePart)} className={boxInput} {...label("Month")}>
            <option value="">Month</option>
            {months.map((m, i) => (
              <option key={m} value={pad(i + 1)}>
                {m}
              </option>
            ))}
          </select>
          <select value={day} onChange={(e) => save(month || e.target.value ? `${month}-${e.target.value}` : "", timePart)} className={boxInput} {...label("Day")}>
            <option value="">Day</option>
            {range(1, 31).map((d) => (
              <option key={d} value={pad(d)}>
                {d}
              </option>
            ))}
          </select>
        </>
      )}
      {item.includeTime && <input type="time" value={timePart} onChange={(e) => save(datePart, e.target.value)} className={boxInput} {...label("Time")} />}
    </div>
  );
}

function TimeField({ item, value, update, aria }: FieldProps<"time">) {
  const [parts, setParts] = useState(() => {
    const [h = "", m = "", s = ""] = str(value).split(":");
    return { h, m, s };
  });
  if (!item.duration) {
    return <input type="time" value={str(value)} onChange={(e) => update(orUndefined(e.target.value))} className={boxInput} {...aria} />;
  }
  const { "aria-labelledby": labelledBy, ...rest } = aria;
  const change = (key: "h" | "m" | "s", v: string) => {
    const next = { ...parts, [key]: v.replace(/\D/g, "").slice(0, 2) };
    setParts(next);
    const p = (x: string) => pad(Number(x || 0));
    update(next.h || next.m || next.s ? `${p(next.h)}:${p(next.m)}:${p(next.s)}` : undefined);
  };
  const box = (key: "h" | "m" | "s", label: string, max: number) => (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={parts[key]}
        onChange={(e) => change(key, e.target.value)}
        className={`w-20 ${boxInput}`}
        aria-describedby={[labelledBy, rest["aria-describedby"]].filter(Boolean).join(" ")}
        aria-invalid={rest["aria-invalid"]}
      />
    </label>
  );
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex items-end gap-2">
      {box("h", "Hours", 99)}
      <span className="pb-2">:</span>
      {box("m", "Minutes", 59)}
      <span className="pb-2">:</span>
      {box("s", "Seconds", 59)}
    </div>
  );
}

const kindNames: Record<string, string> = {
  document: "document",
  spreadsheet: "spreadsheet",
  pdf: "PDF",
  video: "video",
  presentation: "presentation",
  drawing: "drawing",
  image: "image",
  audio: "audio",
};
const sizeText = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** PUTs the file straight to storage, reporting progress (fetch cannot report upload progress). */
function put(url: string, file: File, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage refused the file (${xhr.status}). Try again.`)));
    xhr.onerror = () => reject(new Error("The upload failed. Check your connection and try again."));
    // slice(): a typeless Blob sends no Content-Type, so the browser needs no CORS preflight header for it.
    xhr.send(file.slice());
  });
}

function FileField({
  item,
  value,
  update,
  aria,
  slug,
  mode,
  onUploads,
}: FieldProps<"file"> & { slug: string; mode: Mode; onUploads: (fn: (n: number) => number) => void }) {
  const files = Array.isArray(value) ? (value as FormFile[]) : [];
  const [busy, setBusy] = useState<{ id: number; name: string; progress: number }[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  const kinds = item.accept?.length ? item.accept : undefined;

  const upload = async (file: File) => {
    const id = ++counter.current;
    setBusy((b) => [...b, { id, name: file.name, progress: 0 }]);
    onUploads((n) => n + 1);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(slug)}/upload`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id, name: file.name, size: file.size, type: file.type, preview: mode === "preview" }),
      });
      const body = (await res.json().catch(() => null)) as { key?: string; url?: string; error?: string } | null;
      if (!res.ok || !body?.key || !body.url) throw new Error(body?.error ?? `The server responded ${res.status}.`);
      await put(body.url, file, (progress) => setBusy((b) => b.map((u) => (u.id === id ? { ...u, progress } : u))));
      const added: FormFile = { key: body.key, name: file.name, size: file.size, type: file.type };
      update((prev) => [...(Array.isArray(prev) ? (prev as FormFile[]) : []), added]);
    } catch (e) {
      setNote(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
    } finally {
      setBusy((b) => b.filter((u) => u.id !== id));
      onUploads((n) => n - 1);
    }
  };

  const choose = (list: FileList | null) => {
    setNote(null);
    const chosen = [...(list ?? [])];
    const room = item.maxFiles - files.length - busy.length;
    if (chosen.length > room) setNote(`You can upload at most ${item.maxFiles} file${item.maxFiles === 1 ? "" : "s"}.`);
    for (const file of chosen.slice(0, Math.max(0, room))) {
      if (kinds && !fileAccepted(kinds, file.name)) setNote(`${file.name} is not an allowed file type.`);
      else if (file.size > item.maxSizeMb * 1024 * 1024) setNote(`${file.name} is larger than ${item.maxSizeMb} MB.`);
      else if (file.size === 0) setNote(`${file.name} is empty.`);
      else void upload(file);
    }
    if (input.current) input.current.value = "";
  };

  if (mode === "prefill") return <p className="text-sm text-muted">File upload questions can&apos;t be pre-filled.</p>;

  return (
    <div role="group" {...aria}>
      <p className="text-sm text-muted">
        Upload {item.maxFiles === 1 ? "1" : `up to ${item.maxFiles}`} {kinds ? kinds.map((k) => kindNames[k] ?? k).join(", ") : "supported"} file
        {item.maxFiles === 1 ? "" : "s"}. Max {item.maxSizeMb} MB{item.maxFiles === 1 ? "" : " per file"}.
      </p>
      {(files.length > 0 || busy.length > 0) && (
        <ul className="mt-3 space-y-2">
          {files.map((f) => (
            <li key={f.key} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-muted">{sizeText(f.size)}</span>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-muted hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-saffron"
                aria-label={`Remove ${f.name}`}
                onClick={() => update((prev) => {
                  const rest = (Array.isArray(prev) ? (prev as FormFile[]) : []).filter((x) => x.key !== f.key);
                  return rest.length ? rest : undefined;
                })}
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
          {busy.map((u) => (
            <li key={u.id} className="rounded-lg border border-line px-3 py-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{u.name}</span>
                <span className="text-muted">{Math.round(u.progress * 100)}%</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-label={`Uploading ${u.name}`} aria-valuenow={Math.round(u.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="fm-progress h-full bg-[var(--accent)]" style={{ transform: `scaleX(${u.progress})` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {files.length + busy.length < item.maxFiles && (
        <button type="button" className={`mt-3 gap-2 ${secondaryButton}`} onClick={() => input.current?.click()}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Add file
        </button>
      )}
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        multiple={item.maxFiles > 1}
        accept={acceptAttribute(kinds)}
        onChange={(e) => choose(e.target.files)}
      />
      {note && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {note}
        </p>
      )}
    </div>
  );
}
