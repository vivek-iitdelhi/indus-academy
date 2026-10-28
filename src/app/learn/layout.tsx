import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gt, lt } from "drizzle-orm";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { ButtonLink, Container } from "@/components/ui";
import { db } from "@/db";
import { courses, enrollments, liveSessions } from "@/db/schema";
import { liveStatus, OPENS_EARLY_MS } from "@/lib/live";
import { hasAccess } from "@/lib/lms/access";
import { getUser, isAdminEmail } from "@/lib/session";

const LONGEST_CLASS_MS = 10 * 60 * 60_000; // 8 h max length + the hour of grace, rounded up

/** Live classes open right now in the learner's courses, for the "Live now" bar on every /learn page. */
async function openClasses(userId: string) {
  const now = Date.now();
  const rows = await db
    .select({ id: liveSessions.id, title: liveSessions.title, startsAt: liveSessions.startsAt, durationMinutes: liveSessions.durationMinutes, courseId: courses.id, slug: courses.slug })
    .from(liveSessions)
    .innerJoin(courses, eq(liveSessions.courseId, courses.id))
    .innerJoin(enrollments, and(eq(enrollments.courseId, courses.id), eq(enrollments.userId, userId)))
    .where(and(lt(liveSessions.startsAt, new Date(now + OPENS_EARLY_MS)), gt(liveSessions.startsAt, new Date(now - LONGEST_CLASS_MS))));
  const open = rows.filter((r) => liveStatus(r) === "open");
  const allowed = await Promise.all(open.map((r) => hasAccess(userId, r.courseId)));
  return open.filter((_, i) => allowed[i]);
}

export const metadata: Metadata = {
  title: "My learning",
  robots: { index: false, follow: false },
};

// No redirect here: a layout cannot see the nested path, so redirecting would send a
// signed-out deep link (e.g. a lesson from an email) to /learn after sign-in. Every
// /learn page calls requireUser("/learn/...") with its own path instead.
export default async function LearnLayout({ children }: LayoutProps<"/learn">) {
  const user = await getUser();
  if (!user) return children;
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <Container className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2 text-sm">
          <Link href="/learn" aria-label="My courses" className="shrink-0">
            <Logo />
          </Link>
          <nav aria-label="Learner" className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-muted">
            <Link href="/learn" className="font-medium text-ink hover:text-pine">
              My courses
            </Link>
            <Link href="/courses" className="hover:text-ink">
              Browse courses
            </Link>
            <Link href="/learn/certificates" className="hover:text-ink">
              Certificates
            </Link>
            {(await isAdminEmail(user.email)) && (
              <Link href="/admin" className="hover:text-ink">
                Admin
              </Link>
            )}
            <Link href="/learn/account" className="max-w-40 truncate hover:text-ink">
              {user.name || "Account"}
            </Link>
            <SignOutButton className="hover:text-ink" />
          </nav>
        </Container>
      </header>
      {(await openClasses(user.id)).map((c) => (
        <div key={c.id} className="border-b border-line bg-mint/40">
          <Container className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <p>
              <span className="mr-2 inline-block size-2 rounded-full bg-red-600 align-middle" aria-hidden />
              <span className="font-medium">Live now:</span> {c.title}
            </p>
            <ButtonLink href={`/learn/${c.slug}/live/${c.id}`} variant="dark" className="h-9">
              Join live
            </ButtonLink>
          </Container>
        </div>
      ))}
      {children}
    </>
  );
}
