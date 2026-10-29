import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { AutoRefresh } from "@/components/auto-refresh";
import { CertificateActions, HolderNameForm } from "@/components/certificate-actions";
import { Accent, ButtonLink, Container, Eyebrow } from "@/components/ui";
import { company, site } from "@/content/site";
import { db } from "@/db";
import { courses, liveSessions } from "@/db/schema";
import { isUuid } from "@/lib/distributors";
import { liveStatus } from "@/lib/live-times";
import { formatIssueDate, linkedInAddUrl, listCertificates } from "@/lib/lms/certificates";
import { setCertificateSearchVisible } from "./actions";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "My certificates",
  robots: { index: false, follow: false },
};

/**
 * Arriving from the last class of a course (?from=<class id>), the certificate is issued only
 * once webinar.gg's attendance list is in, about a minute after the class ends: until then say so
 * and check again; after, if there is still none, say what's left.
 */
async function FromClass({ sessionId, issued }: { sessionId: string; issued: Set<string> }) {
  const [row] = await db
    .select({ session: liveSessions, slug: courses.slug, title: courses.title })
    .from(liveSessions)
    .innerJoin(courses, eq(liveSessions.courseId, courses.id))
    .where(eq(liveSessions.id, sessionId));
  if (!row || issued.has(row.slug)) return null;
  const { session } = row;
  const box = "mt-10 rounded-2xl border border-line bg-white p-6";
  if (liveStatus(session) !== "ended") {
    return (
      <p className={box}>
        <strong>{session.title}</strong> is still going.{" "}
        <Link href={`/learn/${row.slug}/live/${session.id}`} className="font-medium text-pine underline underline-offset-4">
          Rejoin the class
        </Link>
      </p>
    );
  }
  if (!session.attendanceSyncedAt) {
    return (
      <div role="status" className={box}>
        <p className="font-medium">Preparing your certificate for {row.title}…</p>
        <p className="mt-1 text-sm text-muted">We&apos;re confirming attendance for the class. It takes about a minute; this page updates by itself.</p>
        <AutoRefresh seconds={10} />
      </div>
    );
  }
  return (
    <p className={box}>
      No certificate for {row.title} yet: it&apos;s issued once every lesson is done and every class attended or its recording watched.{" "}
      <Link href={`/learn/${row.slug}`} className="font-medium text-pine underline underline-offset-4">
        See what&apos;s left
      </Link>
    </p>
  );
}

export default async function CertificatesPage({ searchParams }: PageProps<"/learn/certificates">) {
  const user = await requireUser("/learn/certificates");
  const rows = await listCertificates(user.id);
  const { from } = await searchParams;

  return (
    <Container className="max-w-5xl! py-16 sm:py-24">
      <Eyebrow>My certificates</Eyebrow>
      <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
        {rows.length > 0 ? (
          <>
            Proof of the work <Accent>you put in</Accent>.
          </>
        ) : (
          <>
            No certificates <Accent>yet</Accent>.
          </>
        )}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
        {rows.length > 0
          ? `Issued by ${company.legalName}. Each has a public page anyone can use to check it.`
          : "Finish every lesson in a course and its certificate appears here, ready to download and add to LinkedIn."}
      </p>
      {typeof from === "string" && isUuid(from) && (
        <FromClass sessionId={from} issued={new Set(rows.map((r) => r.courseSlug))} />
      )}
      {rows.length === 0 && !from && (
        <div className="mt-10">
          <ButtonLink href="/learn" variant="dark">
            Go to my courses
          </ButtonLink>
        </div>
      )}

      <ul className="mt-12 space-y-8">
        {rows.map(({ certificate: c, courseTitle }) => {
          const verifyPath = `/verify/${c.serial}`;
          const verifyUrl = `${site.url}${verifyPath}`;
          const imageUrl = `/api/certificates/${c.serial}/image`;
          return (
            <li key={c.serial} className="grid gap-6 rounded-[1.75rem] bg-white p-4 ring-1 ring-line sm:grid-cols-[18rem_1fr] sm:p-5">
              <Link href={verifyPath} className="block overflow-hidden rounded-[1.25rem] ring-1 ring-line">
                <Image
                  src={imageUrl}
                  alt={`Certificate for ${courseTitle}`}
                  width={1600}
                  height={1131}
                  unoptimized
                  className="h-auto w-full"
                />
              </Link>
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.01em]">{courseTitle}</h2>
                  <p className="mt-1 text-sm text-muted">
                    Issued {formatIssueDate(c.issuedAt)} · <span className="font-mono">{c.serial}</span>
                  </p>
                  <p className={`mt-2 text-sm font-medium ${c.revokedAt ? "text-red-700" : "text-pine"}`}>
                    {c.revokedAt ? `Revoked on ${formatIssueDate(c.revokedAt)}` : "Valid"}
                  </p>
                </div>
                {c.revokedAt ? (
                  <p className="text-sm text-muted">
                    This certificate was withdrawn. Questions? Email{" "}
                    <a href={`mailto:${site.email}`} className="font-medium text-pine underline underline-offset-4">
                      {site.email}
                    </a>
                    .
                  </p>
                ) : c.holderName.trim() === "" ? (
                  <HolderNameForm serial={c.serial} />
                ) : (
                  <CertificateActions
                    imageUrl={imageUrl}
                    verifyUrl={verifyUrl}
                    linkedInUrl={linkedInAddUrl({
                      courseTitle,
                      serial: c.serial,
                      issuedAt: c.issuedAt,
                      certUrl: verifyUrl,
                      organizationId: process.env.LINKEDIN_ORGANIZATION_ID,
                      organizationName: company.legalName,
                    })}
                  />
                )}
                {!c.revokedAt && c.holderName.trim() !== "" && (
                  <form action={setCertificateSearchVisible} className="text-sm text-muted">
                    <input type="hidden" name="serial" value={c.serial} />
                    <input type="hidden" name="visible" value={c.searchVisible ? "0" : "1"} />
                    {c.searchVisible
                      ? "Search engines can list this certificate's page, so it shows up when someone searches your name. "
                      : "Hidden from search engines. Anyone with the link can still check it. "}
                    <button type="submit" className="font-medium text-pine underline underline-offset-4 hover:text-ink">
                      {c.searchVisible ? "Hide from search" : "Show in search"}
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
