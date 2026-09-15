import { flagship } from "@/content/programs";
import { company, founder } from "@/content/site";
import { LogoMark } from "./logo";
import { Accent, CheckList, Container, Section, SectionHeading } from "./ui";

export function CertificateSection({
  className = "",
  programName = flagship.name,
}: {
  className?: string;
  programName?: string;
}) {
  return (
    <Section id="certification" className={className}>
      <Container className="grid gap-16 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Certification"
            title={
              <>
                A certificate backed by a <Accent>registered company</Accent> and real work.
              </>
            }
            intro="Indus AI Academy certificates are issued by our parent company, and only once your capstone project has been reviewed, so they stand for skills you can demonstrate."
          />
          <div className="mt-8">
            <CheckList
              items={[
                `Issued by ${company.legalName}`,
                ...company.credentials,
                "Awarded only after a reviewed capstone project",
                "Ready to share on LinkedIn and your CV",
              ]}
            />
          </div>
        </div>

        <div className="reveal relative mx-auto w-full max-w-xl">
          <div
            role="img"
            aria-label={`Sample Indus AI Academy certificate issued by ${company.legalName}`}
            className="rounded-[1.75rem] bg-white p-3 shadow-2xl shadow-ink/10 ring-1 ring-line"
          >
            <div className="relative overflow-hidden rounded-[1.25rem] border-2 border-pine/15 px-6 py-10 text-center sm:px-12">
              <LogoMark className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-auto -translate-x-1/2 -translate-y-1/2 text-pine/[0.05]" />
              <div className="relative">
                <div className="flex items-center justify-center gap-2 text-pine">
                  <LogoMark className="h-5 w-auto" />
                  <span className="text-sm font-semibold">Indus AI Academy</span>
                </div>
                <p className="mt-8 font-mono text-[0.68rem] uppercase tracking-[0.25em] text-muted">
                  Certificate of completion
                </p>
                <p className="mt-6 text-sm text-muted">This certifies that</p>
                <p className="mt-2 font-serif text-4xl italic sm:text-5xl">Your Name</p>
                <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted">
                  has completed the <span className="font-semibold text-ink">{programName}</span>, including a
                  capstone project reviewed by faculty.
                </p>
                <div className="mt-10 grid grid-cols-2 gap-6 text-left text-xs">
                  <div className="border-t border-line pt-3">
                    <p className="font-semibold text-ink">{founder.name}</p>
                    <p className="mt-0.5 text-muted">
                      {founder.role} · {founder.credential}
                    </p>
                  </div>
                  <div className="border-t border-line pt-3 text-right">
                    <p className="font-semibold text-ink">{company.legalName}</p>
                    <p className="mt-0.5 text-muted">Issuing company</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <span className="absolute -top-3 right-8 rounded-full bg-saffron px-3 py-1 text-xs font-medium text-ink">
            Sample
          </span>
        </div>
      </Container>
    </Section>
  );
}
