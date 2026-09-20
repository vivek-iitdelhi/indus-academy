import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import founderPhoto from "@/assets/vivek-gupta.jpg";
import { BlogCard } from "@/components/blog-card";
import { JsonLd } from "@/components/json-ld";
import { getAllPosts } from "@/lib/blog";
import { faqSchema } from "@/lib/schema";
import { pageMetadata } from "@/lib/metadata";
import { CertificateSection } from "@/components/certificate-section";
import { CtaBand } from "@/components/cta-band";
import { Faq } from "@/components/faq";
import { FounderSection } from "@/components/founder-section";
import { HeroConsole } from "@/components/hero-console";
import { ToolMarquee } from "@/components/tool-marquee";
import {
  Accent,
  ArrowIcon,
  ButtonLink,
  CheckList,
  Container,
  Eyebrow,
  Section,
  SectionHeading,
} from "@/components/ui";
import { offerings } from "@/content/consulting";
import { rolloutSteps, tracks } from "@/content/enterprise";
import { flagship } from "@/content/programs";
import { founder, homeFaqs, tools } from "@/content/site";

export const metadata: Metadata = pageMetadata({
  title: "Indus AI Academy: AI Courses & Corporate AI Training",
  description:
    "Live, hands-on AI courses and certification for professionals, corporate AI training for employees, and AI consulting. Founded by an IIT Delhi alumnus.",
  path: "/",
  absoluteTitle: true,
});

const pillars = [
  {
    n: "01",
    title: "Academy",
    audience: "For individuals",
    href: "/programs",
    description:
      "Live certification programs that take you from curious to capable, building real AI workflows every week.",
    points: ["AI Generalist Certification", "AI for Leaders", "Automation & Agents Bootcamp"],
  },
  {
    n: "02",
    title: "Enterprise upskilling",
    audience: "For teams and companies",
    href: "/enterprise",
    description:
      "Role-based programs that make every function AI-fluent, designed around your tools, data and goals.",
    points: ["Tracks for every department", "On site, online or hybrid", "Measured before and after"],
    featured: true,
  },
  {
    n: "03",
    title: "AI consulting",
    audience: "For leaders with a mandate",
    href: "/consulting",
    description: "Strategy, discovery and hands-on builds that move AI out of slide decks and into production.",
    points: ["Readiness and roadmaps", "Agents, automations and voice AI", "Governance that enables speed"],
  },
];

const principles = [
  {
    title: "Taught by builders",
    body: "Sessions are led by practitioners who build AI systems, so you learn what holds up in real work.",
  },
  {
    title: "Work-first curriculum",
    body: "Every session ends with something built: a prompt library, an automation, an agent or an app.",
  },
  {
    title: "Outcomes you can measure",
    body: "Skills assessments before and after, reviewed capstones, and adoption metrics leadership can see.",
  },
  {
    title: "Responsible by default",
    body: "Data privacy, evaluation and human oversight are built into every program, not bolted on.",
  },
];

export default function Home() {
  const modules = flagship.modules ?? [];

  return (
    <>
      {/* Hero */}
      <section className="px-3 pt-3 sm:px-4">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink text-paper">
          <div
            aria-hidden="true"
            className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
          />
          <div aria-hidden="true" className="absolute -right-40 -top-48 size-[40rem] rounded-full bg-pine/60 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-56 left-1/4 size-[28rem] rounded-full bg-saffron/10 blur-3xl" />

          <Container className="relative grid gap-16 py-20 sm:py-24 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:py-28">
            <div>
              <Eyebrow tone="dark">AI Courses · Corporate AI Training · AI Consulting</Eyebrow>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.0] tracking-[-0.04em] text-balance sm:text-6xl lg:text-7xl">
                Build an <span className="whitespace-nowrap font-serif font-normal italic text-mint">AI-fluent</span>{" "}
                workforce.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-paper/70">
                Live AI courses for professionals, corporate AI training for entire organizations, and AI consulting
                that turns ambition into systems running in production.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <ButtonLink href="/enterprise">Upskill my team</ButtonLink>
                <ButtonLink href="/programs" variant="outline-dark">
                  Explore programs
                </ButtonLink>
              </div>

              <dl className="mt-14 grid max-w-xl grid-cols-1 gap-6 border-t border-white/10 pt-8 sm:grid-cols-3">
                {[
                  ["Live", "Cohort-led, never pre-recorded"],
                  ["Hands-on", "Every session ends in something built"],
                  ["Role-based", "Tracks for every function"],
                ].map(([term, detail]) => (
                  <div key={term}>
                    <dt className="font-serif text-2xl italic text-mint">{term}</dt>
                    <dd className="mt-1 text-sm text-paper/55">{detail}</dd>
                  </div>
                ))}
              </dl>

              <a
                href="#founder"
                className="mt-10 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-5 text-sm text-paper/75 transition-colors hover:bg-white/10"
              >
                <Image src={founderPhoto} alt="" sizes="36px" className="size-9 rounded-full object-cover" />
                <span>
                  Founded by <span className="font-medium text-paper">{founder.name}</span> · {founder.credential}
                </span>
              </a>
            </div>

            <HeroConsole />
          </Container>
        </div>
      </section>

      {/* Tools */}
      <section className="py-14">
        <Container>
          <p className="text-center text-sm text-muted">Hands-on with the tools your teams will actually use</p>
        </Container>
        <div className="mt-6">
          <ToolMarquee tools={tools} />
        </div>
      </section>

      {/* Pillars */}
      <Section id="what-we-do" className="pt-10 sm:pt-14">
        <Container>
          <SectionHeading
            eyebrow="What we do"
            title={
              <>
                One partner for every stage of your <Accent>AI journey</Accent>.
              </>
            }
            intro="Whether you are upskilling yourself, a single team or a whole company, or you need AI built into how you work, we meet you where you are."
          />

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {pillars.map((p) => (
              <Link
                key={p.title}
                href={p.href}
                className={`reveal group flex flex-col rounded-3xl border p-8 transition-colors ${
                  p.featured
                    ? "border-pine bg-pine text-paper hover:bg-pine-2"
                    : "border-line bg-white/50 hover:border-ink/25 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-sm ${p.featured ? "text-mint" : "text-pine"}`}>{p.n}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      p.featured ? "bg-white/10 text-paper/80" : "bg-ink/[0.05] text-muted"
                    }`}
                  >
                    {p.audience}
                  </span>
                </div>
                <h3 className="mt-10 text-3xl font-semibold tracking-tight">{p.title}</h3>
                <p className={`mt-4 leading-relaxed ${p.featured ? "text-paper/75" : "text-muted"}`}>
                  {p.description}
                </p>
                <ul className={`mt-8 space-y-2.5 border-t pt-6 text-sm ${p.featured ? "border-white/15" : "border-line"}`}>
                  {p.points.map((point) => (
                    <li key={point} className="flex items-center gap-2.5">
                      <span className="size-1.5 rounded-full bg-saffron" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
                <span className="mt-auto inline-flex items-center gap-2 pt-10 text-sm font-medium">
                  Learn more
                  <ArrowIcon className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      {/* Principles */}
      <Section className="bg-paper-2">
        <Container className="grid gap-14 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading
            eyebrow="Why Indus AI Academy"
            title={
              <>
                Built for the AI era, <Accent>not adapted</Accent> to it.
              </>
            }
            intro="Most AI training stops at theory and tool tours. Ours is designed around the work people do every day, and judged by what they can do afterwards."
          />
          <div className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2">
            {principles.map((p, i) => (
              <div key={p.title} className="reveal bg-paper p-8">
                <span className="font-mono text-xs text-pine">0{i + 1}</span>
                <h3 className="mt-6 text-xl font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <FounderSection />

      {/* Flagship program */}
      <Section id="flagship" className="bg-paper-2">
        <Container className="grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <SectionHeading
              eyebrow="Flagship program"
              title={flagship.name}
              intro={flagship.summary}
            />
            <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm">
              {[
                ["Duration", flagship.duration],
                ["Format", flagship.format],
                ["Level", flagship.level],
                ["For", flagship.audience],
              ].map(([term, detail]) => (
                <div key={term} className="bg-paper p-5">
                  <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">{term}</dt>
                  <dd className="mt-2 font-medium leading-snug">{detail}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={`/programs/${flagship.slug}`} variant="dark">
                View full curriculum
              </ButtonLink>
              <ButtonLink href="/contact?interest=programs" variant="outline">
                Join the next cohort
              </ButtonLink>
            </div>
          </div>

          <ol className="space-y-3">
            {modules.map((m, i) => (
              <li key={m.title} className="reveal flex gap-5 rounded-2xl border border-line bg-white/50 p-6">
                <span className="font-mono text-sm text-pine">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold tracking-tight">{m.title}</h3>
                    <span className="font-mono text-xs text-muted">{m.hours} hrs</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{m.topics.join(" · ")}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <CertificateSection />

      {/* Enterprise tracks */}
      <Section className="bg-paper-2">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <SectionHeading
              eyebrow="Enterprise upskilling"
              title={
                <>
                  A track for <Accent>every function</Accent> in your business.
                </>
              }
              intro="Generic AI training changes very little. We tailor each track to the role, the tools and the decisions people actually make."
            />
            <ButtonLink href="/enterprise" variant="outline">
              Explore enterprise programs
            </ButtonLink>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((t) => (
              <div key={t.role} className="reveal rounded-3xl border border-line bg-paper p-7">
                <h3 className="text-xl font-semibold tracking-tight">{t.role}</h3>
                <p className="mt-2 text-muted">{t.focus}</p>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {t.outcomes.map((o) => (
                    <li key={o} className="rounded-full bg-mint/60 px-3 py-1 text-xs text-pine">
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* How it works */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="How we work"
            title={
              <>
                From first workshop to <Accent>lasting adoption</Accent>.
              </>
            }
          />
          <ol className="mt-14 grid gap-4 md:grid-cols-5">
            {rolloutSteps.map((s, i) => (
              <li key={s.step} className="reveal relative rounded-3xl border border-line p-6">
                <span className="grid size-9 place-items-center rounded-full bg-ink font-mono text-sm text-paper">
                  {i + 1}
                </span>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">{s.step}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.description}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Consulting */}
      <section className="px-3 sm:px-4">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink py-20 text-paper sm:py-28">
          <div
            aria-hidden="true"
            className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_bottom_left,black,transparent_65%)]"
          />
          <Container className="relative grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHeading
                tone="dark"
                eyebrow="AI consulting"
                title={
                  <>
                    Beyond training, we <Accent>build with you</Accent>.
                  </>
                }
                intro="When a team is ready to move, we help design, build and govern the AI systems that change how the business runs, and we train the people who will own them."
              />
              <div className="mt-10">
                <ButtonLink href="/consulting">Explore consulting</ButtonLink>
              </div>
            </div>
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {offerings.map((o, i) => (
                <li key={o.name} className="flex gap-6 py-5">
                  <span className="font-mono text-sm text-mint">0{i + 1}</span>
                  <div>
                    <h3 className="font-semibold">{o.name}</h3>
                    <p className="mt-1 text-sm text-paper/60">{o.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </div>
      </section>

      {/* Latest articles */}
      <Section>
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <SectionHeading
              eyebrow="From the blog"
              title={
                <>
                  Practical guides to <Accent>working with AI</Accent>.
                </>
              }
            />
            <ButtonLink href="/blog" variant="outline">
              All articles
            </ButtonLink>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {getAllPosts()
              .slice(0, 3)
              .map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
          </div>
        </Container>
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <SectionHeading eyebrow="FAQ" title="Questions, answered." />
            <div className="mt-8">
              <CheckList
                items={["Live, instructor-led sessions", "Built around real work", "Certificates backed by capstones"]}
              />
            </div>
          </div>
          <Faq items={homeFaqs} />
          <JsonLd data={faqSchema(homeFaqs)} />
        </Container>
      </Section>

      <CtaBand
        title={
          <>
            The teams that learn fastest <Accent>win</Accent>.
          </>
        }
        body="Tell us about your goals. We'll recommend the right program, or design one around your organization."
        primary={{ href: "/contact?interest=enterprise", label: "Request a proposal" }}
        secondary={{ href: "/programs", label: "Browse programs" }}
      />
    </>
  );
}
