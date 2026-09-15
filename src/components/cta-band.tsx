import type { ReactNode } from "react";
import { LogoMark } from "./logo";
import { ButtonLink, Container } from "./ui";

export function CtaBand({
  title,
  body,
  primary,
  secondary,
}: {
  title: ReactNode;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <Container className="pb-20 sm:pb-28">
      <div className="reveal relative overflow-hidden rounded-[2rem] bg-pine px-8 py-16 text-paper sm:px-14 sm:py-20">
        <LogoMark className="pointer-events-none absolute -bottom-16 -right-10 h-72 w-auto text-white/[0.07] sm:h-96" />
        <div className="relative max-w-2xl">
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl">{title}</h2>
          <p className="mt-5 text-lg leading-relaxed text-paper/75">{body}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href={primary.href}>{primary.label}</ButtonLink>
            {secondary && (
              <ButtonLink href={secondary.href} variant="outline-dark">
                {secondary.label}
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}
