import { CheckIcon } from "./ui";

const path = [
  { title: "How modern AI works", state: "done" },
  { title: "Prompting & context engineering", state: "done" },
  { title: "Automation with n8n", state: "live" },
  { title: "Building AI agents", state: "next" },
  { title: "Capstone: ship it", state: "next" },
] as const;

const run = [
  ["trigger", "new lead in CRM"],
  ["enrich", "company, role, intent"],
  ["score", "fit 0.87 · high priority"],
  ["draft", "personalized reply"],
] as const;

// Illustrative product UI for the hero: a learner's path plus a capstone agent run.
export function HeroConsole() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mr-0" aria-hidden="true">
      <div className="rounded-2xl border border-white/10 bg-ink-2/90 p-5 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </div>
          <span className="font-mono text-[0.68rem] text-paper/40">learning-path</span>
        </div>

        <p className="mt-6 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-paper/45">Your path</p>
        <ol className="mt-3 space-y-1.5">
          {path.map((m, i) => (
            <li
              key={m.title}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                m.state === "live" ? "bg-white/[0.07] text-paper" : "text-paper/70"
              }`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[0.68rem] ${
                  m.state === "done"
                    ? "bg-mint text-pine"
                    : m.state === "live"
                      ? "bg-saffron text-ink"
                      : "border border-white/15 text-paper/45"
                }`}
              >
                {m.state === "done" ? <CheckIcon className="size-3" /> : i + 1}
              </span>
              <span className="flex-1">{m.title}</span>
              {m.state === "live" && (
                <span className="rounded-full bg-saffron/15 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-saffron">
                  Live
                </span>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4 font-mono text-[0.72rem] leading-6">
          <p className="text-paper/40">capstone · lead-qualifier agent</p>
          {run.map(([step, detail]) => (
            <p key={step} className="text-paper/70">
              <span className="text-mint">▸ {step.padEnd(8, " ")}</span>
              {detail}
            </p>
          ))}
          <p className="text-saffron">✓ queued&nbsp;&nbsp;for human review</p>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-full border border-white/10 bg-pine px-4 py-2 text-xs text-paper shadow-lg sm:flex">
        <span className="size-2 rounded-full bg-saffron" />
        Capstones built on your real workflows
      </div>
    </div>
  );
}
