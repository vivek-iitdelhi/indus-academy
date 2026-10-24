import fs from "node:fs";
import path from "node:path";
import { PageHero } from "@/components/page-hero";
import { ButtonLink, Container } from "@/components/ui";
import { renderMarkdown } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Developers: Partner API",
  description:
    "The Indus AI Academy partner API: licensed courses, protected video playback, learners, completions and co-branded certificates over REST.",
  path: "/developers",
});

// Rendered at build time from docs/distributor-api.md, the contract partners code against,
// so this page and the doc can never disagree. The page hero carries the doc's title.
function loadReference() {
  const markdown = fs.readFileSync(path.join(process.cwd(), "docs/distributor-api.md"), "utf8").replace(/^# .*\n+/, "");
  return renderMarkdown(markdown, 3);
}

export default function DevelopersPage() {
  const { html, headings } = loadReference();
  return (
    <>
      <PageHero
        eyebrow="Developers"
        title="Partner API"
        intro="Deliver our courses on your own platform: course structure and quizzes, protected video playback, and co-branded certificates for your learners, over a simple REST API."
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Developers", path: "/developers" },
        ]}
      >
        <ButtonLink href="/contact?interest=partnership">Get API access</ButtonLink>
      </PageHero>

      <Container className="grid gap-12 py-14 sm:py-16 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
        <aside className="hidden lg:block">
          <nav aria-label="API reference" className="sticky top-28">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted">Reference</p>
            <ol className="mt-4 space-y-1 border-l border-line text-sm">
              {headings.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    className={`-ml-px block border-l border-transparent py-1 text-muted transition-colors hover:border-pine hover:text-ink ${
                      h.depth === 2 ? "pl-4 font-medium" : "pl-7 font-mono text-xs"
                    }`}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
        <div className="prose-article w-full max-w-[48rem]" dangerouslySetInnerHTML={{ __html: html }} />
      </Container>
    </>
  );
}
