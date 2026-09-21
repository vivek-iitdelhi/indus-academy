import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { JsonLd } from "@/components/json-ld";
import { PageHero } from "@/components/page-hero";
import { Accent, ArrowIcon, ButtonLink, CheckList, Container, Section, SectionHeading } from "@/components/ui";
import { formatPrice, SHOW_PRICES } from "@/content/programs";
import { trackBySlug, tracks } from "@/content/tracks";
import { pageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, courseSchemaForTrack, faqSchema } from "@/lib/schema";

export const dynamicParams = false;

export function generateStaticParams() {
  return tracks.map((track) => ({ slug: track.slug }));
}

export async function generateMetadata({ params }: PageProps<"/enterprise/[slug]">): Promise<Metadata> {
  const track = trackBySlug((await params).slug);
  if (!track) return {};
  return pageMetadata({
    title: track.seoTitle,
    description: track.seoDescription,
    path: `/enterprise/${track.slug}`,
    absoluteTitle: true,
  });
}

const deliveryFaqs = (name: string) => [
  {
    q: `How is the ${name} track delivered?`,
    a: "As a private cohort for your company: on site at your office anywhere in India, live online, or hybrid. Sessions usually run a week apart so teams can apply what they learn in between.",
  },
  {
    q: "How many people can attend?",
    a: "Up to 25 people per cohort, so everyone gets hands-on help. Larger teams run in several cohorts, usually department by department.",
  },
  {
    q: "Is the content customized to us?",
    a: "Yes. Before the first session we review your tools, data policies and real workflows, then rebuild the exercises around them. Participants work on your actual tasks, not generic examples.",
  },
];

export default async function TrackPage({ params }: PageProps<"/enterprise/[slug]">) {
  const track = trackBySlug((await params).slug);
  if (!track) notFound();

  const hours = track.sessions.reduce((sum, session) => sum + session.hours, 0);
  const others = tracks.filter((t) => t.slug !== track.slug);
  const faqs = deliveryFaqs(track.name);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Corporate AI training", path: "/enterprise" },
    { name: track.name, path: `/enterprise/${track.slug}` },
  ];

  return (
    <>
      <JsonLd data={courseSchemaForTrack(track)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd data={faqSchema(faqs)} />

      <PageHero eyebrow={`Corporate track · ${track.duration}`} title={track.name} intro={track.summary} breadcrumbs={crumbs}>
        <ButtonLink href="/contact?interest=enterprise">Request a proposal</ButtonLink>
        <ButtonLink href="#curriculum" variant="outline-dark">
          See the curriculum
        </ButtonLink>
      </PageHero>

      <Section>
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Overview" title={track.tagline} intro={`Who it's for: ${track.audience}.`} />
            <div className="mt-8">
              <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-muted">Your team leaves with</h3>
              <div className="mt-5">
                <CheckList items={track.outcomes} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm sm:grid-cols-2">
              {[
                ["Length", track.duration],
                ["Delivery", "On site, live online or hybrid"],
                ["Cohort size", "Up to 25 people"],
                ["Tailoring", "Built around your tools and workflows"],
              ].map(([term, detail]) => (
                <div key={term} className="bg-paper p-5">
                  <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">{term}</dt>
                  <dd className="mt-2 font-medium leading-snug">{detail}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-2xl border border-line bg-white/60 p-6">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">Investment</p>
              {SHOW_PRICES ? (
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  From {formatPrice(track.inHouseFrom)}
                  <span className="ml-2 text-base font-normal text-muted">per cohort + GST</span>
                </p>
              ) : (
                <p className="mt-2 text-lg font-medium">
                  Request a proposal
                  <span className="mt-1 block text-sm font-normal text-muted">
                    Priced per cohort, based on group size and how much tailoring you need.
                  </span>
                </p>
              )}
              <div className="mt-5">
                <ButtonLink href="/contact?interest=enterprise" variant="dark" className="w-full">
                  Request a proposal
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section id="curriculum" className="bg-paper-2">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
            <SectionHeading eyebrow="Curriculum" title={`Session by session: ${track.name}`} />
            <p className="font-mono text-sm text-muted">
              {track.sessions.length} sessions · {hours} live hours
            </p>
          </div>
          <ol className="divide-y divide-line">
            {track.sessions.map((session, i) => (
              <li key={session.title} className="reveal grid gap-5 py-8 md:grid-cols-[6rem_1fr_1.2fr]">
                <div>
                  <span className="font-mono text-sm text-pine">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mt-1 block font-mono text-xs text-muted">{session.hours} hrs</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{session.title}</h3>
                  <p className="mt-3 rounded-xl bg-mint/40 px-4 py-3 text-sm leading-relaxed text-pine">
                    <span className="font-medium">Your team builds:</span> {session.build}
                  </p>
                </div>
                <ul className="space-y-2 text-muted">
                  {session.topics.map((topic) => (
                    <li key={topic} className="flex gap-2.5">
                      <span className="mt-2.5 size-1 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                      {topic}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeading
            eyebrow="Other tracks"
            title={
              <>
                Train <Accent>every function</Accent>, not just one.
              </>
            }
            intro="Most companies run two or three tracks together, with a shared AI Foundations Workshop first."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((t) => (
              <Link
                key={t.slug}
                href={`/enterprise/${t.slug}`}
                className="reveal group flex flex-col rounded-3xl border border-line bg-white/50 p-6 transition-colors hover:border-ink/25 hover:bg-white"
              >
                <span className="font-mono text-xs text-pine">{t.role}</span>
                <h3 className="mt-5 text-lg font-semibold leading-snug tracking-tight">{t.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t.tagline}</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-medium">
                  View track
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
            Bring <Accent>{track.name}</Accent> to your team.
          </>
        }
        body="Tell us your team size, tools and timelines. We'll send a tailored outline and a proposal, usually within two working days."
        primary={{ href: "/contact?interest=enterprise", label: "Request a proposal" }}
        secondary={{ href: "/enterprise", label: "All corporate training" }}
      />
    </>
  );
}
