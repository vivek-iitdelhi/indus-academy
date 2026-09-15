import Link from "next/link";
import { programs } from "@/content/programs";
import { company, site } from "@/content/site";
import { Logo } from "./logo";
import { Container } from "./ui";

const columns = [
  {
    title: "Programs",
    links: programs.map((p) => ({ href: `/programs/${p.slug}`, label: p.name })),
  },
  {
    title: "Enterprise",
    links: [
      { href: "/enterprise#tracks", label: "Role-based tracks" },
      { href: "/enterprise#formats", label: "Training formats" },
      { href: "/enterprise#measurement", label: "Measuring impact" },
      { href: "/contact?interest=enterprise", label: "Request a proposal" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/consulting", label: "AI consulting" },
      { href: "/blog", label: "Blog" },
      { href: "/#faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink text-paper">
      <Container className="grid gap-12 py-16 lg:grid-cols-[1.4fr_2fr]">
        <div className="max-w-sm">
          <Logo tone="dark" />
          <p className="mt-5 leading-relaxed text-paper/60">
            Hands-on AI education and consulting for professionals and the organizations they build.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-paper/60">
            An initiative of {company.legalName}, {company.location}. {company.credentials.join(" · ")}.
          </p>
          <a
            href={`mailto:${site.email}`}
            className="mt-6 inline-block text-mint underline decoration-mint/30 underline-offset-4 hover:decoration-mint"
          >
            {site.email}
          </a>
        </div>

        <div className="grid gap-10 sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-paper/60">{col.title}</h2>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-paper/75 transition-colors hover:text-paper">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>

      <Container className="flex flex-col gap-3 border-t border-white/10 py-8 text-sm text-paper/60 sm:flex-row sm:justify-between">
        <p>
          © {new Date().getFullYear()} {company.legalName}. All rights reserved.
        </p>
        <p>Built in India, for teams everywhere.</p>
      </Container>
    </footer>
  );
}
