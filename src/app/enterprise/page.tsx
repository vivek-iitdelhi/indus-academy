import type { Metadata } from "next";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { Accent, ButtonLink, CheckList, Container, Section, SectionHeading } from "@/components/ui";
import { formats, measurement, rolloutSteps, tracks } from "@/content/enterprise";

export const metadata: Metadata = {
  title: "Enterprise AI upskilling",
  description:
    "Role-based AI upskilling for every function in your organization: executive briefings, cohorts, build sprints and AI champions, measured before and after.",
};

const gaps = [
  {
    title: "Tools are everywhere. Skills aren't.",
    body: "Most companies have rolled out AI licenses. Few have changed how work actually gets done.",
  },
  {
    title: "Generic courses don't stick.",
    body: "People adopt AI when training uses their tools, their data policies and their real tasks.",
  },
  {
    title: "Adoption needs measurement.",
    body: "Without baselines and follow-through, AI programs fade into a one-off event.",
  },
];

const governance = [
  "Training runs inside your approved tools and policies",
  "Sample or anonymized data unless you choose otherwise",
  "Responsible-AI and review practices in every track",
  "NDAs and your security requirements, as standard",
];

export default function EnterprisePage() {
  return (
    <>
      <PageHero
        eyebrow="Enterprise upskilling"
        title={
          <>
            Make every team <Accent>AI-fluent</Accent>, not just the early adopters.
          </>
        }
        intro="Role-based programs that change how your people work, designed around your tools, data and goals, and measured from baseline to results."
      >
        <ButtonLink href="/contact?interest=enterprise">Request a proposal</ButtonLink>
        <ButtonLink href="#tracks" variant="outline-dark">
          See role-based tracks
        </ButtonLink>
      </PageHero>

      {/* The gap */}
      <Section>
        <Container className="grid gap-5 md:grid-cols-3">
          {gaps.map((g, i) => (
            <div key={g.title} className="reveal rounded-3xl border border-line p-8">
              <span className="font-mono text-xs text-pine">0{i + 1}</span>
              <h2 className="mt-6 text-2xl font-semibold tracking-tight">{g.title}</h2>
              <p className="mt-3 leading-relaxed text-muted">{g.body}</p>
            </div>
          ))}
        </Container>
      </Section>

      {/* Tracks */}
      <Section id="tracks" className="bg-paper-2">
        <Container>
          <SectionHeading
            eyebrow="Role-based tracks"
            title={
              <>
                Designed for the work <Accent>each team</Accent> does.
              </>
            }
            intro="Every track combines shared foundations with role-specific workflows, so a finance analyst and a sales lead each leave with tools they will use on Monday."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((t) => (
              <div key={t.role} className="reveal rounded-3xl border border-line bg-paper p-7">
                <h3 className="text-xl font-semibold tracking-tight">{t.role}</h3>
                <p className="mt-2 text-muted">{t.focus}</p>
                <div className="mt-6">
                  <CheckList items={t.outcomes} />
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Formats */}
      <Section id="formats">
        <Container>
          <SectionHeading
            eyebrow="Formats"
            title={
              <>
                Flexible formats, <Accent>one standard</Accent> of quality.
              </>
            }
            intro="Delivered on site across India, live online, or hybrid. Mix formats to reach leadership, managers and every team in between."
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {formats.map((f) => (
              <div key={f.name} className="reveal flex flex-col bg-paper p-8">
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-pine">{f.duration}</span>
                <h3 className="mt-8 text-xl font-semibold tracking-tight">{f.name}</h3>
                <p className="mt-3 leading-relaxed text-muted">{f.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Process */}
      <section className="px-3 sm:px-4">
        <div className="rounded-[2rem] bg-ink py-20 text-paper sm:py-28">
          <Container>
            <SectionHeading
              tone="dark"
              eyebrow="How it works"
              title={
                <>
                  A rollout built to <Accent>last</Accent>.
                </>
              }
            />
            <ol className="mt-14 grid gap-4 md:grid-cols-5">
              {rolloutSteps.map((s, i) => (
                <li key={s.step} className="reveal rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <span className="grid size-9 place-items-center rounded-full bg-saffron font-mono text-sm text-ink">
                    {i + 1}
                  </span>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">{s.step}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-paper/60">{s.description}</p>
                </li>
              ))}
            </ol>
          </Container>
        </div>
      </section>

      {/* Measurement & governance */}
      <Section id="measurement">
        <Container className="grid gap-5 lg:grid-cols-2">
          <div className="reveal rounded-3xl border border-line bg-white/50 p-8 sm:p-10">
            <SectionHeading eyebrow="Measuring impact" title="Know what changed." />
            <div className="mt-8">
              <CheckList items={measurement} />
            </div>
          </div>
          <div className="reveal rounded-3xl border border-line bg-white/50 p-8 sm:p-10">
            <SectionHeading eyebrow="Security & governance" title="Safe by design." />
            <div className="mt-8">
              <CheckList items={governance} />
            </div>
          </div>
        </Container>
      </Section>

      <CtaBand
        title={
          <>
            Let&apos;s map your team&apos;s <Accent>AI roadmap</Accent>.
          </>
        }
        body="Share your goals, team size and timelines. We'll come back with a tailored program outline and proposal."
        primary={{ href: "/contact?interest=enterprise", label: "Request a proposal" }}
        secondary={{ href: "/programs", label: "See open programs" }}
      />
    </>
  );
}
