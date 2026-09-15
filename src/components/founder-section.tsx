import Image from "next/image";
import photo from "@/assets/vivek-gupta.jpg";
import { founder, site } from "@/content/site";
import { Accent, ArrowIcon, Container, Section, SectionHeading } from "./ui";

export function FounderSection() {
  return (
    <Section id="founder">
      <Container className="grid gap-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div className="reveal relative mx-auto w-full max-w-md pb-8">
          <div className="overflow-hidden rounded-[2rem] bg-paper-2">
            <Image
              src={photo}
              alt={`${founder.name}, founder of ${site.name}`}
              placeholder="blur"
              sizes="(min-width: 1024px) 28rem, 90vw"
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
          <div className="absolute bottom-0 left-5 right-5 rounded-2xl bg-ink p-5 text-paper shadow-xl sm:left-auto sm:-right-6 sm:w-72">
            <p className="font-serif text-2xl italic text-mint">{founder.credential}</p>
            <p className="mt-1 text-sm text-paper/60">Indian Institute of Technology Delhi</p>
          </div>
        </div>

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
