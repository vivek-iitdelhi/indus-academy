"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { nav } from "@/content/site";
import { Logo } from "./logo";
import { ButtonLink, Container } from "./ui";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" onClick={close} aria-label="Indus AI Academy home" className="rounded-md">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  active ? "bg-ink/[0.06] text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <ButtonLink href="/contact?interest=enterprise" variant="dark" className="h-10 px-5 text-sm">
            Talk to us
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="grid size-10 place-items-center rounded-full border border-line md:hidden"
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
            {open ? (
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M3 7h14M3 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </Container>

      <div id="mobile-nav" hidden={!open} className="border-t border-line/70 md:hidden">
        <Container className="flex flex-col gap-1 py-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              aria-current={pathname === item.href ? "page" : undefined}
              className="rounded-xl px-3 py-3 text-lg font-medium hover:bg-ink/[0.04]"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-3" onClick={close}>
            <ButtonLink href="/contact?interest=enterprise" variant="dark" className="w-full">
              Talk to us
            </ButtonLink>
          </div>
        </Container>
      </div>
    </header>
  );
}
