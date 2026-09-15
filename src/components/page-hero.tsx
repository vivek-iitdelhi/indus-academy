import type { ReactNode } from "react";
import { Container, Eyebrow } from "./ui";

export function PageHero({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: string;
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
