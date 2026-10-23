"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/forms", label: "Forms" },
  { href: "/admin/learners", label: "Learners" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/certificates", label: "Certificates" },
  { href: "/admin/distributors", label: "Distributors" },
  { href: "/admin/analytics", label: "Partner analytics" },
  { href: "/admin/admins", label: "Admins" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
      {links.map(({ href, label }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active ? "bg-ink text-paper" : "text-muted hover:bg-ink/[0.04] hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
