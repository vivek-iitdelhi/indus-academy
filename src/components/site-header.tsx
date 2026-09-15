"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { nav, type NavItem, type NavLink } from "@/content/site";
import { Logo } from "./logo";
import { ArrowIcon, ButtonLink, Container } from "./ui";

const HOVER_CLOSE_DELAY = 150;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function menuId(item: NavItem) {
  return `menu-${item.href.slice(1)}`;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuLink({
  link,
  onNavigate,
  className,
  children,
}: {
  link: NavLink;
  onNavigate: () => void;
  className: string;
  children: ReactNode;
}) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener" onClick={onNavigate} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={link.href} onClick={onNavigate} className={className}>
      {children}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navRef = useRef<HTMLElement>(null);

  const closeAll = () => {
    setOpenMenu(null);
    setMobileOpen(false);
    setMobileSection(null);
  };

  // Close an open dropdown on outside click or Escape.
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  // Hover opens menus for mouse users only; touch and keyboard use the button.
  const hoverOpen = (label: string) => {
    clearTimeout(closeTimer.current);
    setOpenMenu(label);
  };
  const hoverClose = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), HOVER_CLOSE_DELAY);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" onClick={closeAll} aria-label="Indus AI Academy home" className="rounded-md">
          <Logo />
        </Link>

        <nav ref={navRef} aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            const itemClass = `rounded-full px-4 py-2 text-sm transition-colors ${
              active ? "bg-ink/[0.06] text-ink" : "text-muted hover:text-ink"
            }`;

            if (!item.children) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeAll}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={itemClass}
                >
                  {item.label}
                </Link>
              );
            }

            const open = openMenu === item.label;
            return (
              <div
                key={item.href}
                className="relative"
                onPointerEnter={(e) => e.pointerType === "mouse" && hoverOpen(item.label)}
                onPointerLeave={(e) => e.pointerType === "mouse" && hoverClose()}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={menuId(item)}
                  onClick={() => setOpenMenu(open ? null : item.label)}
                  className={`inline-flex items-center gap-1.5 ${itemClass} ${open ? "text-ink" : ""}`}
                >
                  {item.label}
                  <Chevron open={open} />
                </button>

                <div id={menuId(item)} hidden={!open} className="absolute left-1/2 top-full w-[34rem] -translate-x-1/2 pt-3">
                  <div className="rounded-2xl border border-line bg-paper p-3 shadow-xl shadow-ink/10">
                    <ul className="grid grid-cols-2 gap-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <MenuLink
                            link={child}
                            onNavigate={closeAll}
                            className="block rounded-xl px-4 py-3 transition-colors hover:bg-ink/[0.04]"
                          >
                            <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                              {child.label}
                              {child.external && <span aria-hidden="true">↗</span>}
                            </span>
                            {child.description && (
                              <span className="mt-0.5 block text-sm leading-snug text-muted">{child.description}</span>
                            )}
                          </MenuLink>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-paper-2 px-4 py-3 text-sm">
                      <Link href={item.href} onClick={closeAll} className="font-medium text-ink hover:text-pine">
                        {item.overviewLabel}
                      </Link>
                      {item.cta && (
                        <Link
                          href={item.cta.href}
                          onClick={closeAll}
                          className="group inline-flex items-center gap-1.5 font-medium text-pine"
                        >
                          {item.cta.label}
                          <ArrowIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <ButtonLink href="/contact?interest=enterprise" variant="dark" className="h-10 px-5 text-sm">
            Talk to us
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          className="grid size-10 place-items-center rounded-full border border-line lg:hidden"
        >
          <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
            {mobileOpen ? (
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M3 7h14M3 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </Container>

      <div
        id="mobile-nav"
        hidden={!mobileOpen}
        className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line/70 lg:hidden"
      >
        <Container className="flex flex-col gap-1 py-4">
          {nav.map((item) => {
            if (!item.children) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeAll}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="rounded-xl px-3 py-3 text-lg font-medium hover:bg-ink/[0.04]"
                >
                  {item.label}
                </Link>
              );
            }
            const expanded = mobileSection === item.label;
            return (
              <div key={item.href}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`mobile-${menuId(item)}`}
                  onClick={() => setMobileSection(expanded ? null : item.label)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-lg font-medium hover:bg-ink/[0.04]"
                >
                  {item.label}
                  <Chevron open={expanded} />
                </button>
                <ul id={`mobile-${menuId(item)}`} hidden={!expanded} className="mb-2 ml-3 border-l border-line pl-3">
                  <li>
                    <Link href={item.href} onClick={closeAll} className="block rounded-lg px-3 py-2 font-medium">
                      {item.overviewLabel}
                    </Link>
                  </li>
                  {item.children.map((child) => (
                    <li key={child.href}>
                      <MenuLink
                        link={child}
                        onNavigate={closeAll}
                        className="block rounded-lg px-3 py-2 text-muted hover:text-ink"
                      >
                        {child.label}
                        {child.external && <span aria-hidden="true"> ↗</span>}
                      </MenuLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <div className="mt-3" onClick={closeAll}>
            <ButtonLink href="/contact?interest=enterprise" variant="dark" className="w-full">
              Talk to us
            </ButtonLink>
          </div>
        </Container>
      </div>
    </header>
  );
}
