import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Tone = "light" | "dark";

export function Container({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`mx-auto w-full max-w-7xl px-5 sm:px-8 ${className}`} {...props} />;
}

export function Section({ className = "", ...props }: ComponentProps<"section">) {
  return <section className={`scroll-mt-20 py-20 sm:py-28 ${className}`} {...props} />;
}

export function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: Tone }) {
  return (
    <p
      className={`inline-flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.18em] ${
        tone === "light" ? "text-pine" : "text-mint"
      }`}
    >
      <span className="size-1.5 rounded-full bg-saffron" aria-hidden="true" />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  tone = "light",
  className = "",
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={`max-w-3xl ${className}`}>
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl">
        {title}
      </h2>
      {intro && (
        <p
          className={`mt-5 text-lg leading-relaxed text-pretty ${
            tone === "light" ? "text-muted" : "text-paper/70"
          }`}
        >
          {intro}
        </p>
      )}
    </div>
  );
}

export function Accent({ children }: { children: ReactNode }) {
  return <span className="font-serif font-normal italic">{children}</span>;
}

const buttonVariants = {
  primary: "bg-saffron text-ink hover:bg-saffron-2",
  dark: "bg-ink text-paper hover:bg-pine",
  outline: "border border-ink/15 text-ink hover:border-ink/40 hover:bg-ink/[0.03]",
  "outline-dark": "border border-white/20 text-paper hover:border-white/40 hover:bg-white/10",
};

export function ButtonLink({
  href,
  variant = "primary",
  children,
  className = "",
}: {
  href: string;
  variant?: keyof typeof buttonVariants;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[0.95rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${buttonVariants[variant]} ${className}`}
    >
      {children}
      <ArrowIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckList({ items, tone = "light" }: { items: string[]; tone?: Tone }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
              tone === "light" ? "bg-mint text-pine" : "bg-white/10 text-mint"
            }`}
          >
            <CheckIcon className="size-3" />
          </span>
          <span className={tone === "light" ? "text-ink/80" : "text-paper/80"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}
