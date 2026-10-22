"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { blankItem, changeType, duplicateItem, hasOptions, normalizeItems, removeItem, youtubeId } from "@/lib/admin/forms";
import {
  fileKinds,
  isQuestion,
  itemTypeLabels,
  layoutTypes,
  type ChoiceOption,
  type FormItem,
  type FormItemType,
  type GoTo,
  type TextValidation,
} from "@/lib/forms/types";
import { miniButtonClass } from "../../courses/form-ui";
import { Switch } from "../client";
import { saveItems } from "../actions";

// The Questions tab: a Google Forms-style editor. Every change lives in local state and is
// autosaved ~800 ms after the last edit; a rejected or failed save keeps the edits here.

type Draft = { title: string; description: string; items: FormItem[] };
type Of<T extends FormItemType> = Extract<FormItem, { type: T }>;
type Target = { id: string; label: string };

const SAVE_DELAY_MS = 800;
const questionTypes = (Object.keys(itemTypeLabels) as FormItemType[]).filter((t) => !(layoutTypes as readonly string[]).includes(t));
const move = <T,>(list: T[], from: number, to: number) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};

const lineInput =
  "w-full border-b border-line bg-transparent px-1 py-1.5 transition-colors placeholder:text-muted/70 hover:border-ink/30 focus:border-b-2 focus:border-pine focus:outline-none";
const smallSelect = "h-9 rounded-lg border border-line bg-white px-2 text-sm focus:border-pine focus:outline-none";
const smallInput = "h-9 rounded-lg border border-line bg-white px-2.5 text-sm focus:border-pine focus:outline-none";

export function FormEditor({ formId, initial, color }: { formId: string; initial: Draft; color: string }) {
  const [draft, setDraft] = useState(initial);
  const [selected, setSelected] = useState("header");
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<{ draft: Draft; error: string } | null>(null);
  const queued = useRef(initial);
  const queue = useRef(Promise.resolve());

  const check = useMemo(() => normalizeItems(draft.items), [draft.items]);
  const invalid = Array.isArray(check) ? null : check;

  // Saves run one at a time, in order, so an older save never lands after a newer one.
  const save = useCallback(
    (d: Draft) => {
      queued.current = d;
      queue.current = queue.current.then(async () => {
        setSaving(true);
        try {
          const result = await saveItems(formId, d.items, d.title, d.description);
          if (result.error) setServerError({ draft: d, error: result.error });
          else setSaved(d);
        } catch {
          setServerError({ draft: d, error: "Couldn't reach the server. Your edits are kept on this page." });
        } finally {
          setSaving(false);
        }
      });
    },
    [formId],
  );

  useEffect(() => {
    if (invalid || draft === queued.current) return;
    const timer = setTimeout(() => save(draft), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, invalid, save]);

  const unsaved = draft !== saved;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // Bring a newly inserted (or newly selected) card into view.
  useEffect(() => {
    document.getElementById(`item-${selected}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const setItems = (fn: (items: FormItem[]) => FormItem[]) => setDraft((d) => ({ ...d, items: fn(d.items) }));
  const updateItem = (item: FormItem) => setItems((items) => items.map((i) => (i.id === item.id ? item : i)));
  const insert = (item: FormItem) => {
    setItems((items) => {
      const at = selected === "header" ? 0 : items.findIndex((i) => i.id === selected) + 1 || items.length;
      return [...items.slice(0, at), item, ...items.slice(at)];
    });
    setSelected(item.id);
  };
  const remove = (id: string) => {
    const index = draft.items.findIndex((i) => i.id === id);
    setItems((items) => removeItem(items, id));
    setSelected(draft.items[index - 1]?.id ?? draft.items[index + 1]?.id ?? "header");
  };

  const sections = draft.items.filter((i) => i.type === "section");
  const sectionNumber = new Map(sections.map((s, k) => [s.id, k + 2]));
  const targets: Target[] = sections.map((s, k) => ({ id: s.id, label: `Section ${k + 2} (${s.title || "Untitled section"})` }));
  const selectedItem = draft.items.find((i) => i.id === selected);

  let status: ReactNode;
  if (invalid) status = <span className="text-red-800">Not saved: {invalid.error}</span>;
  else if (serverError && serverError.draft === draft && !saving)
    status = (
      <span className="text-red-800">
        Not saved: {serverError.error}{" "}
        <button type="button" className="underline" onClick={() => save(draft)}>
          Retry
        </button>
      </span>
    );
  else if (saving || unsaved) status = <span className="text-muted">Saving…</span>;
  else status = <span className="text-muted">All changes saved</span>;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,48rem)_auto]">
      <div className="space-y-3 pb-24 lg:pb-8">
        <p role="status" aria-live="polite" className="text-sm">
          {status}
        </p>

        <Card id="header" selected={selected === "header"} onSelect={setSelected} topColor={color}>
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Form title"
            aria-label="Form title"
            maxLength={300}
            className={`${lineInput} text-3xl font-semibold tracking-tight`}
          />
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Form description"
            aria-label="Form description"
            rows={1}
            maxLength={5000}
            className={`${lineInput} mt-3 field-sizing-content resize-none text-sm`}
          />
        </Card>

        {draft.items.map((item, index) => {
          const isSection = item.type === "section";
          const n = isSection ? sectionNumber.get(item.id)! : 0;
          return (
            <div key={item.id} className="space-y-3">
              {isSection && (
                <AfterSection n={n - 1} value={item.goTo ?? "next"} targets={targets} onChange={(goTo) => updateItem({ ...item, goTo })} />
              )}
              <Card
                id={item.id}
                selected={selected === item.id}
                onSelect={setSelected}
                label={isSection ? `Section ${n} of ${sections.length + 1}` : undefined}
                error={invalid?.index === index ? invalid.error : undefined}
              >
                <ItemEditor
                  item={item}
                  selected={selected === item.id}
                  targets={targets}
                  first={index === 0}
                  last={index === draft.items.length - 1}
                  onChange={updateItem}
                  onMove={(delta) => setItems((items) => move(items, index, index + delta))}
                  onDuplicate={() => insert(duplicateItem(item))}
                  onRemove={() => remove(item.id)}
                />
              </Card>
            </div>
          );
        })}
        {sections.length > 0 && <p className="text-center text-xs text-muted">After the last section, the form is submitted.</p>}
      </div>

      <Toolbar
        onAdd={(type) => insert(blankItem(type === "question" ? (selectedItem && isQuestion(selectedItem) ? selectedItem.type : "choice") : type))}
      />
    </div>
  );
}

function Card({
  id,
  selected,
  onSelect,
  label,
  topColor,
  error,
  children,
}: {
  id: string;
  selected: boolean;
  onSelect: (id: string) => void;
  label?: string;
  topColor?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div id={`item-${id}`} className="scroll-mt-6">
      {label && <div className="inline-block rounded-t-lg bg-pine px-3 py-1 text-xs font-medium text-paper">{label}</div>}
      <div
        onClick={() => onSelect(id)}
        onFocusCapture={() => onSelect(id)}
        style={topColor ? { borderTopColor: topColor } : undefined}
        className={`relative rounded-2xl border border-line bg-white p-5 transition-shadow sm:p-6 ${topColor ? "border-t-[10px]" : ""} ${
          label ? "rounded-tl-none" : ""
        } ${selected ? "shadow-md before:absolute before:inset-y-0 before:-left-px before:w-1.5 before:rounded-l-2xl before:bg-pine" : "cursor-pointer hover:border-ink/25"} ${
          error ? "border-red-700/40" : ""
        }`}
      >
        {children}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

const toolbarButtons: { type: FormItemType | "question"; label: string; icon: ReactNode }[] = [
  { type: "question", label: "Add question", icon: <path d="M12 6v12M6 12h12" /> },
  { type: "text", label: "Add title and description", icon: <path d="M5 6h14M12 6v13M8 19h8" /> },
  { type: "image", label: "Add image", icon: <path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01" /> },
  { type: "video", label: "Add video", icon: <path d="M4 6h11v12H4zM15 10l5-3v10l-5-3" /> },
  { type: "section", label: "Add section", icon: <path d="M4 7h16M4 12h16M4 17h16" /> },
];

function Toolbar({ onAdd }: { onAdd: (type: FormItemType | "question") => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center gap-1 border-t border-line bg-white p-2 lg:sticky lg:top-6 lg:inset-x-auto lg:flex-col lg:self-start lg:rounded-2xl lg:border">
      {toolbarButtons.map(({ type, label, icon }) => (
        <button
          key={type}
          type="button"
          title={label}
          aria-label={label}
          onClick={() => onAdd(type)}
          className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </button>
      ))}
    </div>
  );
}

function GoToSelect({ value, targets, onChange, label }: { value: GoTo; targets: Target[]; onChange: (to: GoTo) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${smallSelect} max-w-64`}>
      <option value="next">Continue to next section</option>
      {targets.map((t) => (
        <option key={t.id} value={t.id}>
          Go to {t.label}
        </option>
      ))}
      <option value="submit">Submit form</option>
    </select>
  );
}

/** Stored on the following section item's goTo (see the FormItem contract). */
function AfterSection({ n, value, targets, onChange }: { n: number; value: GoTo; targets: Target[]; onChange: (to: GoTo) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 text-sm">
      <span className="text-muted">After section {n}</span>
      <GoToSelect value={value} targets={targets} onChange={onChange} label={`After section ${n}`} />
    </div>
  );
}

// --- One item ------------------------------------------------------------------------

type ItemProps = {
  item: FormItem;
  selected: boolean;
  targets: Target[];
  first: boolean;
  last: boolean;
  onChange: (item: FormItem) => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

function ItemEditor(props: ItemProps) {
  const { item, selected, onChange } = props;
  if (!selected) return <Preview item={item} />;
  const question = isQuestion(item);
  const layout = !question;
  return (
    <div>
      <div className="flex flex-wrap items-start gap-3">
        <textarea
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
          placeholder={item.type === "section" ? "Untitled section" : question ? "Question" : item.type === "text" ? "Untitled title" : "Title (optional)"}
          aria-label="Title"
          rows={1}
          maxLength={500}
          className={`${lineInput} min-w-0 flex-1 field-sizing-content resize-none rounded-t-lg bg-paper/60 px-3 py-3 ${item.type === "section" ? "text-xl font-semibold" : "font-medium"}`}
        />
        {question && (
          <select
            aria-label="Question type"
            value={item.type}
            onChange={(e) => onChange(changeType(item, e.target.value as FormItemType))}
            className={`${smallSelect} h-12 w-52`}
          >
            {questionTypes.map((t) => (
              <option key={t} value={t}>
                {itemTypeLabels[t]}
              </option>
            ))}
          </select>
        )}
      </div>
      {(item.description !== undefined || layout) && (
        <textarea
          value={item.description ?? ""}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
          placeholder={item.type === "image" || item.type === "video" ? "Caption (optional)" : "Description"}
          aria-label="Description"
          rows={1}
          maxLength={5000}
          className={`${lineInput} mt-3 field-sizing-content resize-none text-sm`}
        />
      )}
      <div className="mt-5">
        <Body {...props} />
      </div>
      <Footer {...props} />
    </div>
  );
}

function Body({ item, onChange, targets }: ItemProps) {
  switch (item.type) {
    case "short":
      return (
        <>
          <p className="w-1/2 border-b border-dotted border-ink/30 pb-1 text-sm text-muted">Short-answer text</p>
          {item.validation && (
            <ValidationEditor value={item.validation} kinds={["number", "text", "length", "regex"]} onChange={(validation) => onChange({ ...item, validation })} />
          )}
        </>
      );
    case "paragraph":
      return (
        <>
          <p className="w-3/4 border-b border-dotted border-ink/30 pb-1 text-sm text-muted">Long-answer text</p>
          {item.validation && (
            <ValidationEditor
              value={item.validation}
              kinds={["length", "regex"]}
              onChange={(validation) => onChange({ ...item, validation: validation as Of<"paragraph">["validation"] })}
            />
          )}
        </>
      );
    case "choice":
    case "checkboxes":
    case "dropdown":
      return <OptionsEditor item={item} targets={targets} onChange={onChange} />;
    case "file":
      return <FileEditor item={item} onChange={onChange} />;
    case "scale":
      return (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <select aria-label="From" value={item.min} onChange={(e) => onChange({ ...item, min: Number(e.target.value) as 0 | 1 })} className={smallSelect}>
              <option value={0}>0</option>
              <option value={1}>1</option>
            </select>
            to
            <select aria-label="To" value={item.max} onChange={(e) => onChange({ ...item, max: Number(e.target.value) })} className={smallSelect}>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          {(["minLabel", "maxLabel"] as const).map((key) => (
            <label key={key} className="flex items-center gap-3">
              <span className="w-6 text-muted">{key === "minLabel" ? item.min : item.max}</span>
              <input
                value={item[key] ?? ""}
                onChange={(e) => onChange({ ...item, [key]: e.target.value })}
                placeholder="Label (optional)"
                maxLength={100}
                className={`${lineInput} max-w-72`}
              />
            </label>
          ))}
        </div>
      );
    case "rating":
      return (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select aria-label="Levels" value={item.max} onChange={(e) => onChange({ ...item, max: Number(e.target.value) })} className={smallSelect}>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <select
            aria-label="Icon"
            value={item.icon}
            onChange={(e) => onChange({ ...item, icon: e.target.value as Of<"rating">["icon"] })}
            className={smallSelect}
          >
            <option value="star">Star</option>
            <option value="heart">Heart</option>
            <option value="thumb">Thumbs up</option>
          </select>
          <RatingIcons max={item.max} icon={item.icon} />
        </div>
      );
    case "choiceGrid":
    case "checkboxGrid": {
      const asList = (l: string[]) => l.map((label) => ({ label }));
      return (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">Rows</p>
            <ListEditor list={asList(item.rows)} noun="Row" marker={(i) => `${i + 1}.`} onChange={(l) => onChange({ ...item, rows: l.map((o) => o.label) })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Columns</p>
            <ListEditor
              list={asList(item.columns)}
              noun="Column"
              marker={() => (item.type === "choiceGrid" ? "○" : "☐")}
              onChange={(l) => onChange({ ...item, columns: l.map((o) => o.label) })}
            />
          </div>
        </div>
      );
    }
    case "date":
      return (
        <div className="flex flex-wrap gap-5 text-sm">
          <Check label="Include year" checked={item.includeYear} onChange={(includeYear) => onChange({ ...item, includeYear })} />
          <Check label="Include time" checked={item.includeTime} onChange={(includeTime) => onChange({ ...item, includeTime })} />
        </div>
      );
    case "time":
      return (
        <div className="flex gap-5 text-sm">
          {[false, true].map((duration) => (
            <label key={String(duration)} className="flex items-center gap-2">
              <input type="radio" checked={item.duration === duration} onChange={() => onChange({ ...item, duration })} className="accent-pine" />
              {duration ? "Duration (hours, minutes, seconds)" : "Time of day"}
            </label>
          ))}
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <input
            value={item.url}
            onChange={(e) => onChange({ ...item, url: e.target.value })}
            placeholder="Image URL (https://…)"
            aria-label="Image URL"
            className={lineInput}
          />
          <input
            value={item.alt ?? ""}
            onChange={(e) => onChange({ ...item, alt: e.target.value })}
            placeholder="Alt text: describe the image for screen readers"
            aria-label="Alt text"
            maxLength={300}
            className={`${lineInput} text-sm`}
          />
          <ImagePreview url={item.url} alt={item.alt} />
        </div>
      );
    case "video":
      return (
        <div className="space-y-3">
          <input
            value={item.url}
            onChange={(e) => onChange({ ...item, url: e.target.value })}
            placeholder="YouTube link (https://www.youtube.com/watch?v=…)"
            aria-label="YouTube link"
            className={lineInput}
          />
          <VideoPreview url={item.url} />
        </div>
      );
    default:
      return null;
  }
}

function Footer({ item, first, last, targets, onChange, onMove, onDuplicate, onRemove }: ItemProps) {
  const menu: { label: string; on: boolean; toggle: () => void }[] = [];
  if (isQuestion(item)) {
    menu.push({
      label: "Description",
      on: item.description !== undefined,
      toggle: () => onChange({ ...item, description: item.description === undefined ? "" : undefined }),
    });
  }
  if (item.type === "short" || item.type === "paragraph") {
    menu.push({
      label: "Response validation",
      on: !!item.validation,
      toggle: () =>
        onChange(
          item.validation
            ? { ...item, validation: undefined }
            : item.type === "short"
              ? { ...item, validation: { kind: "number", op: "isNumber" } }
              : { ...item, validation: { kind: "length", op: "max", n: 500 } },
        ),
    });
  }
  if (item.type === "checkboxes") {
    menu.push({
      label: "Response validation",
      on: !!item.validation,
      toggle: () => onChange({ ...item, validation: item.validation ? undefined : { op: "atLeast", n: 1 } }),
    });
  }
  if ((item.type === "choice" || item.type === "dropdown") && (targets.length > 0 || item.branching)) {
    menu.push({ label: "Go to section based on answer", on: !!item.branching, toggle: () => onChange({ ...item, branching: !item.branching }) });
  }
  if (hasOptions(item.type) && "options" in item) {
    menu.push({ label: "Shuffle option order", on: !!item.shuffle, toggle: () => onChange({ ...item, shuffle: !item.shuffle }) });
  }
  if (item.type === "choiceGrid" || item.type === "checkboxGrid") {
    menu.push(
      { label: "Require a response in each row", on: !!item.requireEachRow, toggle: () => onChange({ ...item, requireEachRow: !item.requireEachRow }) },
      { label: "Limit to one response per column", on: !!item.onePerColumn, toggle: () => onChange({ ...item, onePerColumn: !item.onePerColumn }) },
      { label: "Shuffle row order", on: !!item.shuffleRows, toggle: () => onChange({ ...item, shuffleRows: !item.shuffleRows }) },
    );
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-1 border-t border-line pt-3">
      <button type="button" disabled={first} onClick={() => onMove(-1)} className={miniButtonClass} aria-label="Move up" title="Move up">
        ↑
      </button>
      <button type="button" disabled={last} onClick={() => onMove(1)} className={miniButtonClass} aria-label="Move down" title="Move down">
        ↓
      </button>
      <button type="button" onClick={onDuplicate} className={miniButtonClass}>
        Duplicate
      </button>
      <button type="button" onClick={onRemove} className={`${miniButtonClass} text-red-800`}>
        Delete
      </button>
      {isQuestion(item) && (
        <span className="ml-3 border-l border-line pl-4">
          <Switch label="Required" checked={!!item.required} onChange={(required) => onChange({ ...item, required })} />
        </span>
      )}
      {menu.length > 0 && <Menu items={menu} />}
    </div>
  );
}

function Menu({ items }: { items: { label: string; on: boolean; toggle: () => void }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="More options" className={`${miniButtonClass} ml-1 border-transparent text-lg`}>
        ⋮
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span role="menu" className="absolute right-0 bottom-full z-20 mb-1 w-64 rounded-xl border border-line bg-white py-1.5 shadow-lg">
            <span className="block px-3 pb-1 text-xs text-muted">Show</span>
            {items.map(({ label, on, toggle }) => (
              <button
                key={label}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                onClick={() => {
                  toggle();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink/[0.04]"
              >
                <span className="w-4 text-pine">{on ? "✓" : ""}</span>
                {label}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-pine" />
      {label}
    </label>
  );
}

// --- Type-specific editors ----------------------------------------------------------------

function OptionsEditor({ item, targets, onChange }: { item: Of<"choice" | "checkboxes" | "dropdown">; targets: Target[]; onChange: (item: FormItem) => void }) {
  const branching = item.type !== "checkboxes" && item.branching;
  const hasOther = item.type !== "dropdown";
  const marker = (i: number) => (item.type === "choice" ? "○" : item.type === "checkboxes" ? "☐" : `${i + 1}.`);
  return (
    <div>
      <ListEditor
        list={item.options}
        noun="Option"
        marker={marker}
        onChange={(options) => onChange({ ...item, options } as FormItem)}
        trailing={
          branching
            ? (i) => (
                <GoToSelect
                  label={`After “${item.options[i].label}”`}
                  value={item.options[i].goTo ?? "next"}
                  targets={targets}
                  onChange={(goTo) => onChange({ ...item, options: item.options.map((o, j) => (j === i ? { ...o, goTo } : o)) } as FormItem)}
                />
              )
            : undefined
        }
      />
      {hasOther && item.other && (
        <div className="mt-1 flex items-center gap-3 text-sm">
          <span className="w-5 text-center text-muted">{marker(0)}</span>
          <span className="flex-1 border-b border-dotted border-ink/30 py-1.5 text-muted">Other…</span>
          <button type="button" onClick={() => onChange({ ...item, other: false })} className={`${miniButtonClass} border-transparent`} aria-label="Remove Other">
            ✕
          </button>
        </div>
      )}
      {hasOther && !item.other && (
        <p className="mt-2 pl-8 text-sm text-muted">
          or{" "}
          <button type="button" onClick={() => onChange({ ...item, other: true })} className="font-medium text-pine hover:underline">
            add “Other”
          </button>
        </p>
      )}
      {item.type === "checkboxes" && item.validation && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <select
            aria-label="Rule"
            value={item.validation.op}
            onChange={(e) => onChange({ ...item, validation: { ...item.validation!, op: e.target.value as "atLeast" } })}
            className={smallSelect}
          >
            <option value="atLeast">Select at least</option>
            <option value="atMost">Select at most</option>
            <option value="exactly">Select exactly</option>
          </select>
          <NumberInput label="Number" value={item.validation.n} onChange={(n) => onChange({ ...item, validation: { ...item.validation!, n: n as number } })} />
          <input
            value={item.validation.message ?? ""}
            onChange={(e) => onChange({ ...item, validation: { ...item.validation!, message: e.target.value } })}
            placeholder="Custom error text"
            aria-label="Custom error text"
            maxLength={300}
            className={`${smallInput} min-w-48 flex-1`}
          />
        </div>
      )}
    </div>
  );
}

/** Editable labels: Enter adds the next one, pasting several lines adds one per line. */
function ListEditor({
  list,
  noun,
  marker,
  trailing,
  onChange,
}: {
  list: ChoiceOption[];
  noun: string;
  marker: (i: number) => ReactNode;
  trailing?: (i: number) => ReactNode;
  onChange: (list: ChoiceOption[]) => void;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusAt = useRef<number | null>(null);
  useEffect(() => {
    if (focusAt.current === null) return;
    inputs.current[focusAt.current]?.focus();
    focusAt.current = null;
  });
  const insert = (at: number, labels: string[], replace = 0) => {
    const next = [...list];
    next.splice(at, replace, ...labels.map((label) => ({ label })));
    focusAt.current = at + labels.length - 1;
    onChange(next);
  };
  const placeholder = new RegExp(`^${noun} \\d+$`);

  return (
    <div className="space-y-1">
      {list.map((option, i) => (
        <div key={i} className="group flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="w-5 text-center text-sm text-muted">{marker(i)}</span>
          <input
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={option.label}
            aria-label={`${noun} ${i + 1}`}
            maxLength={500}
            onChange={(e) => onChange(list.map((o, j) => (j === i ? { ...o, label: e.target.value } : o)))}
            onFocus={(e) => placeholder.test(e.currentTarget.value) && e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              insert(i + 1, [`${noun} ${list.length + 1}`]);
            }}
            onPaste={(e) => {
              const lines = e.clipboardData.getData("text").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
              if (lines.length < 2) return;
              e.preventDefault();
              // Replace this option if it is still blank or the default name, else add after it.
              const replaceThis = !option.label.trim() || placeholder.test(option.label);
              insert(replaceThis ? i : i + 1, lines, replaceThis ? 1 : 0);
            }}
            className={`${lineInput} min-w-40 flex-1 border-transparent text-sm`}
          />
          {trailing?.(i)}
          <span className="flex gap-0.5 opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
            <button type="button" disabled={i === 0} onClick={() => onChange(move(list, i, i - 1))} className={`${miniButtonClass} border-transparent`} aria-label={`Move ${noun.toLowerCase()} up`}>
              ↑
            </button>
            <button
              type="button"
              disabled={i === list.length - 1}
              onClick={() => onChange(move(list, i, i + 1))}
              className={`${miniButtonClass} border-transparent`}
              aria-label={`Move ${noun.toLowerCase()} down`}
            >
              ↓
            </button>
            <button
              type="button"
              disabled={list.length === 1}
              onClick={() => onChange(list.filter((_, j) => j !== i))}
              className={`${miniButtonClass} border-transparent`}
              aria-label={`Remove ${noun.toLowerCase()}`}
            >
              ✕
            </button>
          </span>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <span className="w-5 text-center text-sm text-muted">{marker(list.length)}</span>
        <button type="button" onClick={() => insert(list.length, [`${noun} ${list.length + 1}`])} className="py-1.5 text-sm text-muted hover:text-ink">
          Add {noun.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

function NumberInput({ value, onChange, label }: { value: number | undefined; onChange: (n: number | undefined) => void; label: string }) {
  return (
    <input
      type="number"
      aria-label={label}
      placeholder={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      className={`${smallInput} w-28`}
    />
  );
}

type Kind = TextValidation["kind"];
const validationOps: Record<Kind, [string, string][]> = {
  number: [
    ["gt", "Greater than"],
    ["gte", "Greater than or equal to"],
    ["lt", "Less than"],
    ["lte", "Less than or equal to"],
    ["eq", "Equal to"],
    ["neq", "Not equal to"],
    ["between", "Between"],
    ["notBetween", "Not between"],
    ["isNumber", "Is number"],
    ["whole", "Whole number"],
  ],
  text: [
    ["contains", "Contains"],
    ["notContains", "Doesn't contain"],
    ["email", "Email"],
    ["url", "URL"],
  ],
  length: [
    ["max", "Maximum character count"],
    ["min", "Minimum character count"],
  ],
  regex: [
    ["contains", "Contains"],
    ["notContains", "Doesn't contain"],
    ["matches", "Matches"],
    ["notMatches", "Doesn't match"],
  ],
};
const kindLabels: Record<Kind, string> = { number: "Number", text: "Text", length: "Length", regex: "Regular expression" };
const kindDefaults: Record<Kind, TextValidation> = {
  number: { kind: "number", op: "isNumber" },
  text: { kind: "text", op: "email" },
  length: { kind: "length", op: "max", n: 500 },
  regex: { kind: "regex", op: "matches", pattern: "" },
};

/** Response validation for short answer (all kinds) and paragraph (length, regex). */
function ValidationEditor({ value, kinds, onChange }: { value: TextValidation; kinds: Kind[]; onChange: (v: TextValidation) => void }) {
  // Loosely typed inside: the selects keep kind and op consistent, and the server re-checks.
  const v = value as TextValidation & { a?: number; b?: number; n?: number; value?: string; pattern?: string };
  const set = (patch: Partial<typeof v>) => onChange({ ...v, ...patch } as TextValidation);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <select aria-label="Validation type" value={v.kind} onChange={(e) => onChange(kindDefaults[e.target.value as Kind])} className={smallSelect}>
        {kinds.map((k) => (
          <option key={k} value={k}>
            {kindLabels[k]}
          </option>
        ))}
      </select>
      <select aria-label="Condition" value={v.op} onChange={(e) => set({ op: e.target.value as never })} className={smallSelect}>
        {validationOps[v.kind].map(([op, label]) => (
          <option key={op} value={op}>
            {label}
          </option>
        ))}
      </select>
      {v.kind === "number" && v.op !== "isNumber" && v.op !== "whole" && (
        <>
          <NumberInput label="Number" value={v.a} onChange={(a) => set({ a })} />
          {(v.op === "between" || v.op === "notBetween") && (
            <>
              and <NumberInput label="Number" value={v.b} onChange={(b) => set({ b })} />
            </>
          )}
        </>
      )}
      {v.kind === "text" && (v.op === "contains" || v.op === "notContains") && (
        <input value={v.value ?? ""} onChange={(e) => set({ value: e.target.value })} placeholder="Text" aria-label="Text" className={`${smallInput} w-40`} />
      )}
      {v.kind === "length" && <NumberInput label="Number" value={v.n} onChange={(n) => set({ n })} />}
      {v.kind === "regex" && (
        <input
          value={v.pattern ?? ""}
          onChange={(e) => set({ pattern: e.target.value })}
          placeholder="Pattern, e.g. ^[0-9]{10}$"
          aria-label="Pattern"
          className={`${smallInput} w-56 font-mono`}
        />
      )}
      <input
        value={v.message ?? ""}
        onChange={(e) => set({ message: e.target.value })}
        placeholder="Custom error text"
        aria-label="Custom error text"
        maxLength={300}
        className={`${smallInput} min-w-48 flex-1`}
      />
    </div>
  );
}

const kindLabelsFile: Record<(typeof fileKinds)[number], string> = {
  document: "Document",
  spreadsheet: "Spreadsheet",
  pdf: "PDF",
  video: "Video",
  presentation: "Presentation",
  drawing: "Drawing",
  image: "Image",
  audio: "Audio",
};

function FileEditor({ item, onChange }: { item: Of<"file">; onChange: (item: FormItem) => void }) {
  const accept = item.accept;
  return (
    <div className="space-y-4 text-sm">
      <p className="rounded-xl bg-saffron/15 px-3 py-2">Respondents must sign in to upload files. Files are stored privately; only admins can download them.</p>
      <div>
        <Switch label="Allow only specific file types" checked={accept !== undefined} onChange={(on) => onChange({ ...item, accept: on ? [] : undefined })} />
      </div>
      {accept && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fileKinds.map((kind) => (
            <Check
              key={kind}
              label={kindLabelsFile[kind]}
              checked={accept.includes(kind)}
              onChange={(on) => onChange({ ...item, accept: on ? [...accept, kind] : accept.filter((k) => k !== kind) })}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          Maximum number of files
          <select value={item.maxFiles} onChange={(e) => onChange({ ...item, maxFiles: Number(e.target.value) as 1 })} className={smallSelect}>
            {[1, 5, 10].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Maximum file size
          <select value={item.maxSizeMb} onChange={(e) => onChange({ ...item, maxSizeMb: Number(e.target.value) as 1 })} className={smallSelect}>
            {[1, 10, 100].map((n) => (
              <option key={n} value={n}>
                {n} MB
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

// --- Previews (unselected cards) -------------------------------------------------------------

const ratingIcons = { star: "★", heart: "♥", thumb: "👍" } as const;

function RatingIcons({ max, icon }: { max: number; icon: keyof typeof ratingIcons }) {
  return (
    <span className="text-lg tracking-widest text-muted" aria-hidden>
      {ratingIcons[icon].repeat(max)}
    </span>
  );
}

function ImagePreview({ url, alt }: { url: string; alt?: string }) {
  if (!/^https?:\/\//.test(url)) return null;
  // eslint-disable-next-line @next/next/no-img-element -- any admin-supplied host; next/image needs each one configured
  return <img src={url} alt={alt ?? ""} className="max-h-72 max-w-full rounded-lg" />;
}

function VideoPreview({ url }: { url: string }) {
  const id = youtubeId(url);
  if (!id) return url ? <p className="text-sm text-red-800">Not a YouTube link.</p> : null;
  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${id}`}
      title="Video preview"
      allow="encrypted-media; picture-in-picture"
      allowFullScreen
      className="aspect-video w-full max-w-xl rounded-lg"
    />
  );
}

function Preview({ item }: { item: FormItem }) {
  const question = isQuestion(item);
  const required = question && item.required;
  return (
    <div>
      <p className={item.type === "section" ? "text-xl font-semibold" : "font-medium"}>
        {item.title || <span className="text-muted">{item.type === "section" ? "Untitled section" : question ? "Untitled question" : ""}</span>}
        {required && <span className="text-red-700"> *</span>}
        {question && <span className="ml-2 font-mono text-[0.65rem] uppercase tracking-wider text-muted">{itemTypeLabels[item.type]}</span>}
      </p>
      {item.description && <p className="mt-1 whitespace-pre-line text-sm text-muted">{item.description}</p>}
      <div className="mt-3 text-sm text-muted">
        <PreviewBody item={item} />
      </div>
    </div>
  );
}

function PreviewBody({ item }: { item: FormItem }) {
  switch (item.type) {
    case "short":
      return <p className="w-1/2 border-b border-dotted border-ink/30 pb-1">Short-answer text</p>;
    case "paragraph":
      return <p className="w-3/4 border-b border-dotted border-ink/30 pb-1">Long-answer text</p>;
    case "choice":
    case "checkboxes":
    case "dropdown": {
      const marker = (i: number) => (item.type === "choice" ? "○" : item.type === "checkboxes" ? "☐" : `${i + 1}.`);
      const shown = item.options.slice(0, 8);
      return (
        <ul className="space-y-1 text-ink">
          {shown.map((o, i) => (
            <li key={i}>
              <span className="mr-2 text-muted">{marker(i)}</span>
              {o.label}
            </li>
          ))}
          {item.options.length > shown.length && <li className="text-muted">+ {item.options.length - shown.length} more</li>}
          {item.type !== "dropdown" && item.other && (
            <li className="text-muted">
              <span className="mr-2">{marker(0)}</span>Other…
            </li>
          )}
        </ul>
      );
    }
    case "file":
      return (
        <p>
          Up to {item.maxFiles} file{item.maxFiles === 1 ? "" : "s"}, {item.maxSizeMb} MB each
          {item.accept?.length ? ` · ${item.accept.map((k) => kindLabelsFile[k]).join(", ")}` : ""}
        </p>
      );
    case "scale":
      return (
        <p>
          {item.minLabel && `${item.minLabel} `}
          {Array.from({ length: item.max - item.min + 1 }, (_, i) => item.min + i).join("  ")}
          {item.maxLabel && ` ${item.maxLabel}`}
        </p>
      );
    case "rating":
      return <RatingIcons max={item.max} icon={item.icon} />;
    case "choiceGrid":
    case "checkboxGrid":
      return (
        <p>
          {item.rows.length} row{item.rows.length === 1 ? "" : "s"} × {item.columns.length} column{item.columns.length === 1 ? "" : "s"}:{" "}
          {item.columns.join(", ")}
        </p>
      );
    case "date":
      return <p>{["Day", "Month", item.includeYear && "Year", item.includeTime && "Time"].filter(Boolean).join(", ")}</p>;
    case "time":
      return <p>{item.duration ? "Duration" : "Time of day"}</p>;
    case "image":
      return <ImagePreview url={item.url} alt={item.alt} />;
    case "video": {
      const id = youtubeId(item.url);
      // eslint-disable-next-line @next/next/no-img-element -- YouTube's thumbnail host
      return id ? <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="max-h-56 rounded-lg" /> : null;
    }
    default:
      return null;
  }
}
