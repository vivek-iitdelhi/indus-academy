import type { Metadata } from "next";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { Accent, ButtonLink, CheckList, Container, Section, SectionHeading } from "@/components/ui";
import { JsonLd } from "@/components/json-ld";
import { buildExamples, offerings, phases } from "@/content/consulting";
import { pageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";

const description =
  "AI consulting for businesses in India: strategy, use-case discovery, AI agents, voice AI and automation builds, plus governance and team enablement.";

export const metadata: Metadata = pageMetadata({
  title: "AI Consulting Services in India",
  description,
  path: "/consulting",
});

export default function ConsultingPage() {
  return (
    <>
      <JsonLd
        data={serviceSchema({ name: "AI consulting", serviceType: "AI consulting", description, path: "/consulting" })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "AI consulting", path: "/consulting" },
        ])}
      />
      <PageHero
        eyebrow="AI consulting"
        title={
          <>
            From AI ambition to <Accent>systems in production</Accent>.
          </>
        }
        intro="We help leadership teams decide where AI will pay off, build the first solutions with them, and put the governance and skills in place to scale."
      >
        <ButtonLink href="/contact?interest=consulting">Book a discovery call</ButtonLink>
        <ButtonLink href="#engagement" variant="outline-dark">
          How we engage
        </ButtonLink>
      </PageHero>

      {/* Offerings */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="What we do"
            title={
              <>
                Strategy, build and enablement, <Accent>under one roof</Accent>.
              </>
            }
          />
          {/* Three cards on top, two wider cards below, so five offerings fill the grid evenly. */}
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {offerings.map((o, i) => (
              <div
                key={o.name}
                className={`reveal rounded-3xl border p-8 ${i < 3 ? "lg:col-span-2" : "lg:col-span-3"} ${
                  i === 2 ? "border-pine bg-pine text-paper" : "border-line bg-white/50"
                }`}
              >
                <span className={`font-mono text-xs ${i === 2 ? "text-mint" : "text-pine"}`}>0{i + 1}</span>
                <h3 className="mt-8 text-2xl font-semibold tracking-tight">{o.name}</h3>
                <p className={`mt-3 leading-relaxed ${i === 2 ? "text-paper/75" : "text-muted"}`}>{o.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Engagement */}
      <Section id="engagement" className="bg-paper-2">
        <Container>
          <SectionHeading
            eyebrow="Engagement model"
            title={
              <>
                Start small. Prove value. <Accent>Then scale.</Accent>
              </>
            }
            intro="Every engagement is structured to show measurable results early, before you commit to a larger roll-out."
          />
          <ol className="mt-14 grid gap-4 lg:grid-cols-3">
            {phases.map((p, i) => (
              <li key={p.name} className="reveal relative rounded-3xl border border-line bg-paper p-8">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-full bg-ink font-mono text-sm text-paper">
                    {i + 1}
                  </span>
                  <span className="rounded-full bg-mint/60 px-3 py-1 font-mono text-xs text-pine">{p.duration}</span>
                </div>
                <h3 className="mt-8 text-2xl font-semibold tracking-tight">{p.name}</h3>
                <p className="mt-3 leading-relaxed text-muted">{p.description}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* What we build */}
      <Section>
        <Container className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <SectionHeading
            eyebrow="What we build"
            title={
              <>
                AI that does <Accent>real work</Accent>.
              </>
            }
            intro="We focus on systems with clear owners and measurable outcomes, integrated with the CRM, helpdesk, telephony and data tools you already use."
          />
          <div className="reveal rounded-3xl border border-line bg-white/50 p-8 sm:p-10">
            <CheckList items={buildExamples} />
            <p className="mt-8 border-t border-line pt-6 text-sm leading-relaxed text-muted">
              Every build includes hands-on enablement for the team that will run it, so capability stays in your
              organization.
            </p>
          </div>
        </Container>
      </Section>

      <CtaBand
        title={
          <>
            Have a use case in mind? <Accent>Let&apos;s test it.</Accent>
          </>
        }
        body="Tell us what you want to improve. We'll help you judge whether AI is the right answer, and what it would take."
        primary={{ href: "/contact?interest=consulting", label: "Book a discovery call" }}
        secondary={{ href: "/enterprise", label: "Pair it with training" }}
      />
    </>
  );
}
