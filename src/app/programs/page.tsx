import type { Metadata } from "next";
import { CertificateSection } from "@/components/certificate-section";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { Accent, ArrowIcon, ButtonLink, CheckList, Container, Eyebrow, Section } from "@/components/ui";
import { flagship, programs, type Program } from "@/content/programs";

export const metadata: Metadata = {
  title: "Programs",
  description:
    "Live, hands-on AI programs: the AI Generalist Certification, AI for Leaders, the Automation & Agents Bootcamp and the AI Foundations Workshop.",
};

function Facts({ program }: { program: Program }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm sm:grid-cols-2">
      {[
        ["Duration", program.duration],
        ["Format", program.format],
        ["Level", program.level],
        ["For", program.audience],
      ].map(([term, detail]) => (
        <div key={term} className="bg-paper p-5">
          <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">{term}</dt>
          <dd className="mt-2 font-medium leading-snug">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ProgramsPage() {
  const modules = flagship.modules ?? [];
  const totalHours = modules.reduce((sum, m) => sum + m.hours, 0);
  const others = programs.filter((p) => p.slug !== flagship.slug);

  return (
    <>
      <PageHero
        eyebrow="Indus AI Academy programs"
        title={
          <>
            Programs that turn curiosity into <Accent>capability</Accent>.
          </>
        }
        intro="Live, cohort-based programs for individuals and teams. Every one is hands-on, taught by practitioners, and finishes with work you can show."
      >
        <ButtonLink href="/contact?interest=programs">Enquire about the next cohort</ButtonLink>
        <ButtonLink href="#ai-generalist" variant="outline-dark">
          See the curriculum
        </ButtonLink>
      </PageHero>

      {/* Overview */}
      <Section className="pb-0 sm:pb-0">
        <Container className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {programs.map((p) => (
            <a
              key={p.slug}
              href={`#${p.slug}`}
              className="reveal group flex flex-col rounded-3xl border border-line bg-white/50 p-6 transition-colors hover:border-ink/25 hover:bg-white"
            >
              <span className="font-mono text-xs text-pine">{p.duration}</span>
              <h2 className="mt-6 text-xl font-semibold tracking-tight">{p.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.tagline}</p>
              <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-medium">
                Details
                <ArrowIcon className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </a>
          ))}
        </Container>
      </Section>

      {/* Flagship curriculum */}
      <Section id={flagship.slug}>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <Eyebrow>Flagship certification</Eyebrow>
              <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
                {flagship.name}
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted">{flagship.summary}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/contact?interest=programs" variant="dark">
                  Reserve a seat
                </ButtonLink>
              </div>
            </div>
            <div className="space-y-8">
              <Facts program={flagship} />
              <div>
                <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-muted">You will leave with</h3>
                <div className="mt-5">
                  <CheckList items={flagship.outcomes} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-20">
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-6">
              <h3 className="text-2xl font-semibold tracking-tight">Curriculum</h3>
              <p className="font-mono text-sm text-muted">
                {modules.length} modules · {totalHours} live hours
              </p>
            </div>
            <ol className="divide-y divide-line">
              {modules.map((m, i) => (
                <li key={m.title} className="reveal grid gap-4 py-8 md:grid-cols-[5rem_1fr_1.3fr_5rem]">
                  <span className="font-mono text-sm text-pine">Module {String(i + 1).padStart(2, "0")}</span>
                  <h4 className="text-xl font-semibold tracking-tight">{m.title}</h4>
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
          </div>
        </Container>
      </Section>

      <CertificateSection className="bg-paper-2" />

      {/* Other programs */}
      {others.map((p, i) => (
        <Section key={p.slug} id={p.slug} className={i % 2 === 1 ? "bg-paper-2" : ""}>
          <Container className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <Eyebrow>{p.duration}</Eyebrow>
              <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.03em]">{p.name}</h2>
              <p className="mt-3 font-serif text-2xl italic text-pine">{p.tagline}</p>
              <p className="mt-5 text-lg leading-relaxed text-muted">{p.summary}</p>
              <div className="mt-8">
                <ButtonLink href="/contact?interest=programs" variant="dark">
                  Enquire
                </ButtonLink>
              </div>
            </div>
            <div className="space-y-8">
              <Facts program={p} />
              <div>
                <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-muted">You will leave with</h3>
                <div className="mt-5">
                  <CheckList items={p.outcomes} />
                </div>
              </div>
            </div>
          </Container>
        </Section>
      ))}

      <div className="pt-20 sm:pt-28">
        <CtaBand
          title={
            <>
              Training a whole team? <Accent>Let&apos;s tailor it.</Accent>
            </>
          }
          body="Any program can run as a private cohort for your company, adapted to your tools, policies and real use cases."
          primary={{ href: "/contact?interest=enterprise", label: "Request a private cohort" }}
          secondary={{ href: "/enterprise", label: "Enterprise upskilling" }}
        />
      </div>
    </>
  );
}
