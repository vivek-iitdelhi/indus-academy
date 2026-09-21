import type { Metadata } from "next";
import Link from "next/link";
import { CertificateSection } from "@/components/certificate-section";
import { CtaBand } from "@/components/cta-band";
import { JsonLd } from "@/components/json-ld";
import { PageHero } from "@/components/page-hero";
import { ProgramFacts } from "@/components/program-facts";
import { Accent, ButtonLink, Container, Section } from "@/components/ui";
import { formatPrice, programs, SHOW_PRICES } from "@/content/programs";
import { activePrice, formatDate } from "@/lib/pricing";
import { pageMetadata } from "@/lib/metadata";
import { breadcrumbSchema } from "@/lib/schema";

export const metadata: Metadata = pageMetadata({
  title: "AI Courses & Certification Programs",
  description:
    "Live, hands-on AI courses in India: AI Generalist Certification, AI for Leaders, AI Automation & Agents Bootcamp and AI Foundations Workshop.",
  path: "/programs",
});

export default function ProgramsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Programs", path: "/programs" },
        ])}
      />
      <PageHero
        eyebrow="AI courses and certification"
        title={
          <>
            Programs that turn curiosity into <Accent>capability</Accent>.
          </>
        }
        intro="Live, cohort-based AI courses for individuals and teams. Every one is hands-on, taught by practitioners, and finishes with work you can show."
      >
        <ButtonLink href="/contact?interest=programs">Enquire about the next cohort</ButtonLink>
        <ButtonLink href="/enterprise" variant="outline-dark">
          Training a whole team?
        </ButtonLink>
      </PageHero>

      <Section>
        <Container className="grid gap-5 lg:grid-cols-2">
          {programs.map((p) => (
            <article key={p.slug} className="reveal flex flex-col rounded-3xl border border-line bg-white/50 p-8 sm:p-10">
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-pine">{p.duration}</span>
              <h2 className="mt-6 text-3xl font-semibold tracking-tight">
                <Link href={`/programs/${p.slug}`} className="hover:text-pine">
                  {p.name}
                </Link>
              </h2>
              <p className="mt-3 font-serif text-xl italic text-pine">{p.tagline}</p>
              <p className="mt-4 leading-relaxed text-muted">{p.summary}</p>
              <ProgramFacts program={p} className="mt-8" />
              {p.cohort && (
                <p className="mt-6 text-sm">
                  <span className="font-medium">Next cohort:</span> starts {formatDate(p.cohort.startDate)}
                  <span className="block text-muted">{p.cohort.schedule}</span>
                </p>
              )}
              {SHOW_PRICES &&
                (() => {
                  const price = activePrice(p);
                  if (!price) return null;
                  return (
                    <p className="mt-4 text-lg font-semibold tracking-tight">
                      {formatPrice(price.amount)}
                      {price.isEarlyBird && (
                        <span className="ml-2 text-sm font-normal text-muted line-through">
                          {formatPrice(price.listPrice)}
                        </span>
                      )}
                      <span className="ml-2 text-sm font-normal text-muted">per seat + GST</span>
                      {price.isEarlyBird && price.until && (
                        <span className="mt-1 block text-sm font-normal text-pine">
                          Early bird: first {price.seats} seats, until {formatDate(price.until)}
                        </span>
                      )}
                    </p>
                  );
                })()}
              <div className="mt-auto flex flex-wrap gap-3 pt-8">
                <ButtonLink href={`/programs/${p.slug}`} variant="dark">
                  View program
                </ButtonLink>
                <ButtonLink href="/contact?interest=programs" variant="outline">
                  Enquire
                </ButtonLink>
              </div>
            </article>
          ))}
        </Container>
      </Section>

      <CertificateSection className="bg-paper-2" />

      <div className="pt-20 sm:pt-28">
        <CtaBand
          title={
            <>
              Training a whole team? <Accent>Let&apos;s tailor it.</Accent>
            </>
          }
          body="Any program can run as a private cohort for your company, adapted to your tools, policies and real use cases."
          primary={{ href: "/contact?interest=enterprise", label: "Request a private cohort" }}
          secondary={{ href: "/enterprise", label: "Corporate AI training" }}
        />
      </div>
    </>
  );
}
