import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateSection } from "@/components/certificate-section";
import { CtaBand } from "@/components/cta-band";
import { Faq } from "@/components/faq";
import { JsonLd } from "@/components/json-ld";
import { PageHero } from "@/components/page-hero";
import { ProgramFacts } from "@/components/program-facts";
import { Accent, ArrowIcon, ButtonLink, CheckList, Container, Section, SectionHeading } from "@/components/ui";
import { programs } from "@/content/programs";
import { pageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, courseSchema, faqSchema } from "@/lib/schema";

export const dynamicParams = false;

export function generateStaticParams() {
  return programs.map((p) => ({ slug: p.slug }));
}

function getProgram(slug: string) {
  return programs.find((p) => p.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/programs/[slug]">): Promise<Metadata> {
  const program = getProgram((await params).slug);
  if (!program) return {};
  return pageMetadata({
    title: program.seoTitle,
    description: program.seoDescription,
    path: `/programs/${program.slug}`,
    absoluteTitle: true,
  });
}

export default async function ProgramPage({ params }: PageProps<"/programs/[slug]">) {
  const program = getProgram((await params).slug);
  if (!program) notFound();

  const modules = program.modules ?? [];
  const totalHours = modules.reduce((sum, m) => sum + m.hours, 0);
  const others = programs.filter((p) => p.slug !== program.slug);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Programs", path: "/programs" },
    { name: program.name, path: `/programs/${program.slug}` },
  ];

  return (
    <>
      <JsonLd data={courseSchema(program)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd data={faqSchema(program.faqs)} />

      <PageHero eyebrow={program.duration} title={program.name} intro={program.summary} breadcrumbs={crumbs}>
        <ButtonLink href="/contact?interest=programs">Enquire about the next cohort</ButtonLink>
        {modules.length > 0 && (
          <ButtonLink href="#curriculum" variant="outline-dark">
            See the curriculum
          </ButtonLink>
        )}
      </PageHero>

      <Section>
        <Container className="grid gap-12 lg:grid-cols-2">
          <SectionHeading eyebrow="Overview" title={program.tagline} intro={`Who it's for: ${program.audience}.`} />
          <div className="space-y-8">
            <ProgramFacts program={program} />
            <div>
              <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-muted">You will leave with</h3>
              <div className="mt-5">
                <CheckList items={program.outcomes} />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {modules.length > 0 && (
        <Section id="curriculum" className="bg-paper-2">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
              <SectionHeading eyebrow="Curriculum" title={`What you'll learn in ${program.name}`} />
              <p className="font-mono text-sm text-muted">
                {modules.length} modules · {totalHours} live hours
              </p>
            </div>
            <ol className="divide-y divide-line">
              {modules.map((m, i) => (
                <li key={m.title} className="reveal grid gap-4 py-8 md:grid-cols-[5rem_1fr_1.3fr_5rem]">
                  <span className="font-mono text-sm text-pine">Module {String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-xl font-semibold tracking-tight">{m.title}</h3>
                  <ul className="space-y-2 text-muted">
                    {m.topics.map((t) => (
                      <li key={t} className="flex gap-2.5">
                        <span className="mt-2.5 size-1 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                        {t}
                      </li>
                    ))}
                  </ul>
                  <span className="font-mono text-sm text-muted md:text-right">{m.hours} hrs</span>
                </li>
              ))}
            </ol>
          </Container>
        </Section>
      )}

      <CertificateSection programName={program.name} />

      <Section className="bg-paper-2">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading eyebrow="FAQ" title={`Questions about ${program.name}`} />
          <Faq items={program.faqs} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeading
            eyebrow="More programs"
            title={
              <>
                Explore other <Accent>AI courses</Accent>.
              </>
            }
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {others.map((p) => (
              <Link
                key={p.slug}
                href={`/programs/${p.slug}`}
                className="reveal group flex flex-col rounded-3xl border border-line bg-white/50 p-6 transition-colors hover:border-ink/25 hover:bg-white"
              >
                <span className="font-mono text-xs text-pine">{p.duration}</span>
                <h3 className="mt-6 text-xl font-semibold tracking-tight">{p.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.tagline}</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-medium">
                  View program
                  <ArrowIcon className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <CtaBand
        title={
          <>
            Ready to join <Accent>{program.name}</Accent>?
          </>
        }
        body="Tell us a little about yourself or your team and we'll share upcoming cohort dates, or set up a private batch for your company."
        primary={{ href: "/contact?interest=programs", label: "Enquire now" }}
        secondary={{ href: "/contact?interest=enterprise", label: "Request a private cohort" }}
      />
    </>
  );
}
