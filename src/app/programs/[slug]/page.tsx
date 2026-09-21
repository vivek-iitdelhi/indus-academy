import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateSection } from "@/components/certificate-section";
import { EnrollButton } from "@/components/enroll-button";
import { CtaBand } from "@/components/cta-band";
import { Faq } from "@/components/faq";
import { JsonLd } from "@/components/json-ld";
import { PageHero } from "@/components/page-hero";
import { ProgramFacts } from "@/components/program-facts";
import { Accent, ArrowIcon, ButtonLink, CheckList, Container, Section, SectionHeading } from "@/components/ui";
import { formatPrice, programBySlug, programs, SHOW_PRICES, totalHours } from "@/content/programs";
import { pageMetadata } from "@/lib/metadata";
import { activePrice, cohortIsOpen, formatDate } from "@/lib/pricing";
import { razorpayConfigured } from "@/lib/razorpay";
import { breadcrumbSchema, courseSchema, faqSchema } from "@/lib/schema";

export const dynamicParams = false;

export function generateStaticParams() {
  return programs.map((program) => ({ slug: program.slug }));
}

export async function generateMetadata({ params }: PageProps<"/programs/[slug]">): Promise<Metadata> {
  const program = programBySlug((await params).slug);
  if (!program) return {};
  return pageMetadata({
    title: program.seoTitle,
    description: program.seoDescription,
    path: `/programs/${program.slug}`,
    absoluteTitle: true,
  });
}

export default async function ProgramPage({ params }: PageProps<"/programs/[slug]">) {
  const program = programBySlug((await params).slug);
  if (!program) notFound();

  const hours = totalHours(program);
  const price = activePrice(program);
  const canPayOnline = SHOW_PRICES && razorpayConfigured() && cohortIsOpen(program) && Boolean(price);
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
        <ButtonLink href="#curriculum" variant="outline-dark">
          See the full curriculum
        </ButtonLink>
      </PageHero>

      <Section>
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Overview" title={program.tagline} intro={`Who it's for: ${program.audience}.`} />
            <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm">
              <div className="bg-paper p-5">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">Prerequisites</p>
                <p className="mt-2 leading-relaxed">{program.prerequisites}</p>
              </div>
              <div className="bg-paper p-5">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">Assessment</p>
                <p className="mt-2 leading-relaxed">{program.assessment}</p>
              </div>
              <div className="bg-paper p-5">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">Certification</p>
                <p className="mt-2 leading-relaxed">{program.certification}</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <ProgramFacts program={program} />

            <div className="rounded-2xl border border-line bg-white/60 p-6">
              {program.cohort && (
                <>
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">Next cohort</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">
                    {program.cohort.name} · starts {formatDate(program.cohort.startDate)}
                  </p>
                  <p className="mt-1 text-sm text-muted">{program.cohort.schedule}</p>
                  <p className="mt-1 text-sm text-muted">
                    {program.cohort.startDate === program.cohort.endDate
                      ? `${program.cohort.seats} seats`
                      : `Ends ${formatDate(program.cohort.endDate)} · ${program.cohort.seats} seats`}
                  </p>
                </>
              )}

              {SHOW_PRICES && price ? (
                <div className={program.cohort ? "mt-5 border-t border-line pt-5" : ""}>
                  <p className="text-3xl font-semibold tracking-tight">
                    {formatPrice(price.amount)}
                    {price.isEarlyBird && (
                      <span className="ml-2 text-lg font-normal text-muted line-through">
                        {formatPrice(price.listPrice)}
                      </span>
                    )}
                    <span className="ml-2 text-base font-normal text-muted">per seat + GST</span>
                  </p>
                  {price.isEarlyBird && price.until && (
                    <p className="mt-2 rounded-lg bg-saffron/15 px-3 py-2 text-sm text-ink">
                      <span className="font-medium">Early bird:</span> first {price.seats} seats, booked by{" "}
                      {formatDate(price.until)}.
                    </p>
                  )}
                  {program.price.inHouseFrom && (
                    <p className="mt-2 text-sm text-muted">
                      Private cohort for your company from {formatPrice(program.price.inHouseFrom)}.
                    </p>
                  )}
                  {program.price.note && <p className="mt-1 text-sm text-muted">{program.price.note}</p>}
                </div>
              ) : (
                <p className="mt-2 text-lg font-medium">
                  Enquire for cohort dates and fees
                  <span className="mt-1 block text-sm font-normal text-muted">
                    Individual seats and private company cohorts available.
                  </span>
                </p>
              )}

              <div className="mt-5">
                {canPayOnline ? (
                  <EnrollButton slug={program.slug} programName={program.name} />
                ) : (
                  <ButtonLink href="/contact?interest=programs" variant="dark" className="w-full">
                    Enquire now
                  </ButtonLink>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-muted">You will leave with</h3>
              <div className="mt-5">
                <CheckList items={program.outcomes} />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section id="curriculum" className="bg-paper-2">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
            <SectionHeading eyebrow="Curriculum" title={`Session by session: ${program.name}`} />
            <p className="font-mono text-sm text-muted">
              {program.sessions.length} sessions · {hours} live hours
            </p>
          </div>
          <ol className="divide-y divide-line">
            {program.sessions.map((session, i) => (
              <li key={session.title} className="reveal grid gap-5 py-8 md:grid-cols-[6rem_1fr_1.2fr]">
                <div>
                  <span className="font-mono text-sm text-pine">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mt-1 block font-mono text-xs text-muted">{session.hours} hrs</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{session.title}</h3>
                  <p className="mt-3 rounded-xl bg-mint/40 px-4 py-3 text-sm leading-relaxed text-pine">
                    <span className="font-medium">You build:</span> {session.build}
                  </p>
                </div>
                <div>
                  <ul className="space-y-2 text-muted">
                    {session.topics.map((topic) => (
                      <li key={topic} className="flex gap-2.5">
                        <span className="mt-2.5 size-1 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                        {topic}
                      </li>
                    ))}
                  </ul>
                  {session.homework && (
                    <p className="mt-3 text-sm text-muted">
                      <span className="font-medium text-ink">Practice:</span> {session.homework}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

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
