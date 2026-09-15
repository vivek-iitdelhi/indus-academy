export function ToolMarquee({ tools }: { tools: string[] }) {
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <ul className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {[...tools, ...tools].map((tool, i) => (
          <li
            key={i}
            aria-hidden={i >= tools.length ? true : undefined}
            className="mr-3 whitespace-nowrap rounded-full border border-line bg-white/60 px-5 py-2.5 text-sm font-medium text-ink/75"
          >
            {tool}
          </li>
        ))}
      </ul>
    </div>
  );
}
