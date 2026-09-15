import type { Metadata } from "next";
import { EnquiryForm } from "@/components/enquiry-form";
import { Accent, Container, Eyebrow } from "@/components/ui";
import { enquiryInterests, site } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to Indus AI Academy about enterprise AI upskilling, individual programs or AI consulting. Tell us your goals and we'll recommend the right next step.",
};

const nextSteps = [
  "We read every enquiry and reply by email.",
  "A short call to understand your goals, teams and timelines.",
  "A tailored recommendation or proposal, with no obligation.",
];

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const { interest } = await searchParams;
  const defaultInterest =
    typeof interest === "string" && enquiryInterests.some((i) => i.value === interest) ? interest : undefined;

  return (
    <Container className="grid gap-14 py-16 sm:py-24 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <Eyebrow>Contact</Eyebrow>
        <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl">
          Let&apos;s build your <Accent>AI advantage</Accent>.
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
          Tell us about your team and what you want to achieve. We&apos;ll recommend a program, or design one around
          your organization.
        </p>

        <h2 className="mt-12 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-muted">What happens next</h2>
        <ol className="mt-5 space-y-4">
          {nextSteps.map((step, i) => (
            <li key={step} className="flex gap-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs text-paper">
                {i + 1}
              </span>
              <span className="pt-0.5 text-ink/80">{step}</span>
            </li>
          ))}
        </ol>

        <p className="mt-12 text-muted">
          Prefer email?{" "}
          <a
            href={`mailto:${site.email}`}
            className="font-medium text-pine underline decoration-pine/30 underline-offset-4 hover:decoration-pine"
          >
            {site.email}
          </a>
        </p>
      </div>

      <div className="self-start rounded-[2rem] border border-line bg-white p-6 shadow-sm sm:p-10">
        <EnquiryForm defaultInterest={defaultInterest} />
      </div>
    </Container>
  );
}
