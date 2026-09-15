import type { Program } from "@/content/programs";

export function ProgramFacts({ program, className = "" }: { program: Program; className?: string }) {
  return (
    <dl className={`grid gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm sm:grid-cols-2 ${className}`}>
      {[
        ["Duration", program.duration],
        ["Format", program.format],
        ["Level", program.level],
        ["For", program.audience],
      ].map(([term, detail]) => (
        <div key={term} className="bg-paper p-5">
          <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">{term}</dt>
          <dd className="mt-2 font-medium leading-snug">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}
