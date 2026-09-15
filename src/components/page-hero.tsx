import Link from "next/link";
import type { ReactNode } from "react";
import { Container, Eyebrow } from "./ui";

export function PageHero({
  eyebrow,
  title,
  intro,
  breadcrumbs,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: string;
  breadcrumbs?: { name: string; path: string }[];
  children?: ReactNode;
}) {
  return (
    <section className="px-3 pt-3 sm:px-4">
      <div className="relative overflow-hidden rounded-[2rem] bg-ink text-paper">
        <div
          aria-hidden="true"
          className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
        />
        <div aria-hidden="true" className="absolute -right-40 -top-40 size-[34rem] rounded-full bg-pine/60 blur-3xl" />
        <Container className="relative py-20 sm:py-24">
          {breadcrumbs && (
            <nav aria-label="Breadcrumb" className="mb-8">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-paper/60">
                {breadcrumbs.map((crumb, i) => (
                  <li key={crumb.path} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden="true">/</span>}
                    {i < breadcrumbs.length - 1 ? (
                      <Link href={crumb.path} className="transition-colors hover:text-paper">
                        {crumb.name}
                      </Link>
                    ) : (
                      <span aria-current="page" className="text-paper/85">
                        {crumb.name}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <Eyebrow tone="dark">{eyebrow}</Eyebrow>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/70">{intro}</p>
          {children && <div className="mt-10 flex flex-wrap gap-3">{children}</div>}
        </Container>
      </div>
    </section>
  );
}
