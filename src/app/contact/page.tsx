import type { Metadata } from "next";
import { EnquiryForm } from "@/components/enquiry-form";
import { Accent, Container, Eyebrow } from "@/components/ui";
import { company, enquiryInterests, site } from "@/content/site";
import { pageMetadata } from "@/lib/metadata";

const linkClass = "font-medium text-pine underline decoration-pine/30 underline-offset-4 hover:decoration-pine";

// Canonical stays /contact for every ?interest= variant, so they aren't indexed as duplicates.
export const metadata: Metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Talk to Indus AI Academy about corporate AI training, AI courses or AI consulting. Share your goals and we'll recommend the right next step.",
  path: "/contact",
});

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

        <h2 className="mt-12 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-muted">Reach us directly</h2>
        <dl className="mt-5 space-y-4 text-ink/80">
          <div>
            <dt className="text-sm text-muted">Email</dt>
            <dd className="mt-1">
              <a href={`mailto:${site.email}`} className={linkClass}>
                {site.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Phone</dt>
            <dd className="mt-1">
              <a href={company.phoneHref} className={linkClass}>
                {company.phone}
              </a>
              <span className="block text-sm text-muted">Mon–Sat, 10:00–19:00 IST</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Registered office</dt>
            <dd className="mt-1 not-italic">
              <address className="not-italic leading-relaxed">
                {company.legalName}
                <br />
                {company.address.street}
                <br />
                {company.address.locality}
                <br />
                {company.address.region} {company.address.postalCode}, {company.address.country}
              </address>
            </dd>
          </div>
        </dl>
      </div>

      <div className="self-start rounded-[2rem] border border-line bg-white p-6 shadow-sm sm:p-10">
        <EnquiryForm defaultInterest={defaultInterest} />
      </div>
    </Container>
  );
}
