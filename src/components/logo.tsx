// The Indus diamond, traced from the brand SVG. Its inner "A" doubles as the Academy mark.
export const logoPath =
  "M61.06 156.6H144.46M61.06 156.6L9.3 104.64M61.06 156.6L75.46 104.64M144.46 156.6L196.22 104.64M144.46 156.6L129.74 104.64M196.22 104.64L197.52 103.34L102.3 7.76M196.22 104.64H129.74M102.3 7.76L8 103.34L9.3 104.64M102.3 7.76L75.46 104.64M102.3 7.76L129.74 104.64M9.3 104.64H75.46M75.46 104.64H129.74";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 206 164" fill="none" aria-hidden="true" className={className}>
      <path
        d={logoPath}
        stroke="currentColor"
        strokeWidth="10.44"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={`h-6 w-auto ${tone === "light" ? "text-pine" : "text-mint"}`} />
      <span className="text-[1.05rem] font-semibold tracking-tight">
        Indus AI <span className="font-serif text-[1.2em] font-normal italic">Academy</span>
      </span>
    </span>
  );
}
