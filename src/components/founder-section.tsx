import award from "@/assets/vivek-award.jpg";
import photo from "@/assets/vivek-gupta.jpg";
import { founder, site } from "@/content/site";
import { FounderCarousel } from "./founder-carousel";
import { Accent, ArrowIcon, Container, Section, SectionHeading } from "./ui";

export function FounderSection() {
  return (
    <Section id="founder">
      <Container className="grid gap-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <FounderCarousel
          slides={[
            {
              src: photo,
              alt: `${founder.name}, founder of ${site.name}`,
              caption: `${founder.name}, founder of ${site.name}.`,
            },
            {
              src: award,
              alt: `${founder.name} receiving an award for his work in AI from Union Cabinet Minister Shri Chirag Paswan`,
              caption: founder.awardCaption,
            },
          ]}
        />

        <div>
          <SectionHeading
            eyebrow="Founder-led"
            title={
              <>
                Led by an <Accent>IIT Delhi</Accent> alumnus who builds AI for a living.
              </>
            }
          />
          <div className="mt-8 space-y-4 text-lg leading-relaxed text-muted">
            {founder.bio.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <a
            href={founder.venture.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-8 flex items-center justify-between gap-6 rounded-2xl border border-line bg-white/60 px-6 py-5 transition-colors hover:border-ink/25 hover:bg-white"
          >
            <span>
              <span className="block font-semibold tracking-tight">Founder of {founder.venture.name}</span>
              <span className="mt-1 block text-sm text-muted">{founder.venture.blurb}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-pine">
              {founder.venture.url.replace("https://", "")}
              <ArrowIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </a>

          <ul className="mt-8 flex flex-wrap gap-2">
            {founder.highlights.map((h) => (
              <li key={h} className="rounded-full border border-line bg-white/60 px-4 py-1.5 text-sm">
                {h}
              </li>
            ))}
          </ul>

          <div className="mt-10 border-t border-line pt-6">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted">
              Previously built technology at
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-xl font-semibold tracking-tight text-ink/65">
              {founder.previously.map((company) => (
                <li key={company}>{company}</li>
              ))}
            </ul>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <p className="font-semibold">{founder.name}</p>
              <p className="text-sm text-muted">
                {founder.role}, {site.name}
              </p>
            </div>
            <a
              href={founder.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 text-sm font-medium text-pine underline decoration-pine/30 underline-offset-4 hover:decoration-pine"
            >
              View LinkedIn profile
              <ArrowIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </Container>
    </Section>
  );
}
