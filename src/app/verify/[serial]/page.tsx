import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { JsonLd } from "@/components/json-ld";
import { Accent, CheckIcon, Container, Eyebrow } from "@/components/ui";
import { company, site } from "@/content/site";
import { formatIssueDate, getCertificate, verifyCertificateHash } from "@/lib/lms/certificates";

// Rendered on every request (one indexed query) so a revocation shows the moment it is made.
const load = cache(async (serial: string) => {
  await connection();
  const row = await getCertificate(serial);
  if (!row) return null;
  const { certificate } = row;
  const status = certificate.revokedAt ? "revoked" : verifyCertificateHash(certificate) ? "valid" : "unverified";
  return { ...row, status } as const;
});

const statusLine = (r: NonNullable<Awaited<ReturnType<typeof load>>>) =>
  r.status === "valid"
    ? "Valid"
    : r.status === "revoked"
      ? `Revoked on ${formatIssueDate(r.certificate.revokedAt!)}`
      : "Could not be verified";

export async function generateMetadata({ params }: PageProps<"/verify/[serial]">): Promise<Metadata> {
  const { serial } = await params;
  const r = await load(serial);
  if (!r) return { title: "Certificate not found", robots: { index: false } };
  const { certificate: c } = r;
  const named = c.holderName.trim() !== "";
  // The holder's name leads the title: this page is what someone finds by searching it.
  const title = named ? `${c.holderName} · ${r.courseTitle} certificate` : `Certificate ${c.serial}`;
  const description = `${c.holderName || "A learner"} completed ${r.courseTitle} with ${site.name}. Issued ${formatIssueDate(c.issuedAt)} by ${company.legalName}. Status: ${statusLine(r)}.`;
  const image = { url: `/api/certificates/${c.serial}/image`, width: 1600, height: 1131, alt: `${title}: ${r.courseTitle}` };
  return {
    title,
    description,
    // Valid certificates are listed by search engines unless the holder opted out;
    // revoked or unverifiable ones never are.
    robots: r.status === "valid" && named && c.searchVisible ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical: `/verify/${c.serial}` },
    openGraph: { title, description, url: `/verify/${c.serial}`, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

const tone = {
  valid: "border-pine/25 bg-mint/50 text-pine",
  revoked: "border-red-700/30 bg-red-50 text-red-800",
  unverified: "border-saffron/60 bg-saffron/10 text-ink",
};

export default async function VerifyPage({ params }: PageProps<"/verify/[serial]">) {
  const { serial } = await params;
  const r = await load(serial);
  if (!r) notFound();
  const { certificate: c } = r;

  return (
    <Container className="max-w-5xl! py-16 sm:py-24">
      {r.status === "valid" && c.holderName.trim() && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Person",
            name: c.holderName,
            hasCredential: {
              "@type": "EducationalOccupationalCredential",
              name: `${r.courseTitle} certificate`,
              credentialCategory: "certificate",
              identifier: c.serial,
              dateCreated: c.issuedAt.toISOString(),
              url: `${site.url}/verify/${c.serial}`,
              about: { "@type": "Course", name: r.courseTitle, url: `${site.url}/courses/${r.courseSlug}` },
              recognizedBy: { "@type": "Organization", name: company.legalName, url: site.url },
            },
          }}
        />
      )}
      <Eyebrow>Certificate verification</Eyebrow>
      <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
        {r.status === "valid" ? (
          <>
            This certificate is <Accent>genuine</Accent>.
          </>
        ) : r.status === "revoked" ? (
          <>
            This certificate was <Accent>revoked</Accent>.
          </>
        ) : (
          <>
            This certificate could <Accent>not be verified</Accent>.
          </>
        )}
      </h1>

      <div role="status" className={`mt-8 flex items-start gap-3 rounded-2xl border p-5 text-sm leading-relaxed ${tone[r.status]}`}>
        {r.status === "valid" && <CheckIcon className="mt-0.5 size-4 shrink-0" />}
        <p>
          <strong className="font-semibold">{statusLine(r)}.</strong>{" "}
          {r.status === "valid"
            ? `Issued by ${company.legalName} to the person named below on completing the course.`
            : r.status === "revoked"
              ? `${company.legalName} has withdrawn this certificate. It no longer certifies completion.`
              : `Its record does not match what ${company.legalName} issued, so do not rely on it. Contact ${site.email} if you think this is a mistake.`}
        </p>
      </div>

      <dl className="mt-10 grid gap-x-10 gap-y-6 border-t border-line pt-8 sm:grid-cols-2">
        {[
          ["Awarded to", c.holderName || "Name not yet confirmed"],
          ["Course", r.courseTitle],
          ...(c.partnerName ? [["In partnership with", c.partnerName]] : []),
          ["Issued on", formatIssueDate(c.issuedAt)],
          ["Certificate no.", c.serial],
          ["Issued by", `${company.legalName} (CIN ${company.cin})`],
          ["Status", statusLine(r)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-muted">{label}</dt>
            <dd className="mt-1.5 text-lg font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 rounded-[1.75rem] bg-white p-3 shadow-2xl shadow-ink/10 ring-1 ring-line">
        <Image
          src={`/api/certificates/${c.serial}/image`}
          alt={`Certificate ${c.serial}: ${c.holderName || "learner"}, ${r.courseTitle}`}
          width={1600}
          height={1131}
          unoptimized
          priority
          className="h-auto w-full rounded-[1.25rem]"
        />
      </div>
    </Container>
  );
}
