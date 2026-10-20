import { Accent, ButtonLink, Container, Eyebrow } from "@/components/ui";
import { site } from "@/content/site";

export default function CertificateNotFound() {
  return (
    <Container className="max-w-3xl! py-24 sm:py-32">
      <Eyebrow>Certificate verification</Eyebrow>
      <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
        No certificate with that serial <Accent>exists</Accent>.
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">
        We have no record of a certificate with this serial. Check it was copied exactly as printed on the
        certificate: it looks like <span className="font-mono text-ink">IAA-2026-0001</span>. Certificates we revoke
        still show here as revoked, so a missing serial was never issued by us.
      </p>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Still unsure? Email{" "}
        <a href={`mailto:${site.email}`} className="font-medium text-pine underline underline-offset-4">
          {site.email}
        </a>{" "}
        with the serial and we will confirm it.
      </p>
      <div className="mt-10">
        <ButtonLink href="/" variant="outline">
          Go to {site.name}
        </ButtonLink>
      </div>
    </Container>
  );
}
