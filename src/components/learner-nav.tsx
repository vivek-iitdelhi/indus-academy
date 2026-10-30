"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const links = [
  { href: "/learn", label: "My courses", icon: "M4 5.5A1.5 1.5 0 0 1 5.5 4H10v15H5.5A1.5 1.5 0 0 1 4 17.5v-12ZM10 4h6.5A1.5 1.5 0 0 1 18 5.5v12a1.5 1.5 0 0 1-1.5 1.5H10" },
  { href: "/courses", label: "Browse", icon: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4" },
  { href: "/learn/certificates", label: "Certificates", icon: "M11 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-3 0-1 6 4-2 4 2-1-6" },
  { href: "/learn/account", label: "Account", icon: "M11 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 8c.6-3.5 3.4-5.5 7-5.5s6.4 2 7 5.5" },
];

/** Which link the learner is on. Everything else under /learn belongs to My courses. */
function current(pathname: string) {
  const exact = links.find((l) => l.href !== "/learn" && (pathname === l.href || pathname.startsWith(`${l.href}/`)));
  return exact?.href ?? (pathname.startsWith("/learn") ? "/learn" : null);
}

/** The signed-in menu in the top bar, on wide screens; phones get LearnerTabs instead. */
export function LearnerLinks({ admin = false }: { admin?: boolean }) {
  const active = current(usePathname());
  const items = admin ? [...links, { href: "/admin", label: "Admin" }] : links;
  return (
    <nav aria-label="Learner" className="hidden items-center gap-1 lg:flex">
      {items.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active === l.href ? "page" : undefined}
          className={`rounded-full px-4 py-2 text-sm transition-colors ${active === l.href ? "bg-ink/[0.06] font-medium text-ink" : "text-muted hover:text-ink"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Bottom tabs on phones: labelled and always in view. Not in the lesson player or a class, which need the screen. */
export function LearnerTabs() {
  const pathname = usePathname();
  const active = current(pathname);
  if (pathname.startsWith("/learn") && pathname.split("/").length > 3) return null;
  return (
    <>
      <div aria-hidden className="h-16 shrink-0 lg:hidden" />
      <nav
        aria-label="Learner"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active === l.href ? "page" : undefined}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-xs ${active === l.href ? "font-semibold text-pine" : "text-muted"}`}
          >
            <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" className="size-6">
              <path d={l.icon} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** LearnerTabs on the public pages, for whoever is signed in. */
export function SignedInTabs() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  return session && !pathname.startsWith("/admin") ? <LearnerTabs /> : null;
}
