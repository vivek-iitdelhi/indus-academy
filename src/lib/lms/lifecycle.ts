import { and, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { certificates, courses, enrollments, lessonProgress, lessons, user, type Certificate } from "../../db/schema.ts";
import { sendEmail } from "../email.ts";
import { getCourseOutline, lessonReady, nextIncompleteLesson } from "./courses.ts";

// Lifecycle emails: the certificate-issued note and the idle-learner nudge.

export const IDLE_DAYS = 7;
/** Most nudges sent per cron run; the rest go out on the next run. */
export const NUDGE_BATCH = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

// Next-only modules (their own imports are aliased/extensionless), loaded lazily so
// node --test can still import this file.
const nextOnly = async () => {
  const [{ shell, escapeHtml }, { site, company }, { after }] = await Promise.all([
    import("../newsletter.ts"),
    import("../../content/site.ts"),
    import("next/server.js"),
  ]);
  return { shell, escapeHtml, site, company, after };
};

const from = (siteName: string) => process.env.ENQUIRY_FROM_EMAIL ?? `${siteName} <enquiries@indusai.academy>`;

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#0b1916;color:#f5f3ec;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px">${label}</a>`;

/**
 * Emails the learner about a certificate that was just issued. Runs after the response
 * when called inside a request (so completing a lesson is not slowed by Resend), inline
 * otherwise (scripts). Never throws.
 */
export async function emailCertificateIssued(cert: Certificate) {
  try {
    const { after, ...mail } = await nextOnly();
    const task = () => sendCertificateEmail(cert, mail).catch((e) => console.error("[lifecycle] certificate email:", e));
    try {
      after(task);
    } catch {
      await task(); // outside a request scope
    }
  } catch (error) {
    console.error("[lifecycle] certificate email:", error);
  }
}

/** Tells a client's customer their course is ready here. After the response; never throws. */
export async function emailEnrolled(email: string, name: string, courseSlug: string, courseTitle: string) {
  try {
    const { after, shell, escapeHtml, site } = await nextOnly();
    const url = `${site.url}/learn/${courseSlug}`;
    const first = name.trim().split(/\s+/)[0];
    const course = escapeHtml(courseTitle);
    after(() =>
      sendEmail({
        from: from(site.name),
        to: [email],
        reply_to: site.email,
        subject: `You're enrolled in ${courseTitle}`,
        html: shell(
          `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b1916">Welcome${first ? `, ${escapeHtml(first)}` : ""}!</h1>
           <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#56655f">
             You're enrolled in <strong style="color:#0b1916">${course}</strong>. Your classes, videos and certificate are all on ${escapeHtml(site.name)}. To sign in, use this email address, and we'll send you a link.
           </p>
           ${button(url, "Go to your course")}`,
          `<p style="margin:0">You received this because you were enrolled in a course with ${escapeHtml(site.name)}.</p>`,
        ),
        text: `You're enrolled in ${courseTitle}.\n\nGo to your course: ${url}\nTo sign in, use this email address, and we'll send you a link.`,
      }).catch((e) => console.error("[lifecycle] enrolment email:", e)),
    );
  } catch (error) {
    console.error("[lifecycle] enrolment email:", error);
  }
}

async function sendCertificateEmail(cert: Certificate, { shell, escapeHtml, site, company }: Omit<Awaited<ReturnType<typeof nextOnly>>, "after">) {
  const [row] = await db
    .select({ email: user.email, courseTitle: courses.title })
    .from(user)
    .innerJoin(courses, eq(courses.id, cert.courseId))
    .where(eq(user.id, cert.userId));
  if (!row) return;
  const listUrl = `${site.url}/learn/certificates`;
  const verifyUrl = `${site.url}/verify/${cert.serial}`;
  const first = cert.holderName.trim().split(/\s+/)[0];
  const course = escapeHtml(row.courseTitle);
  await sendEmail({
    from: from(site.name),
    to: [row.email],
    reply_to: site.email,
    subject: `Your certificate for ${row.courseTitle}`,
    html: shell(
      `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b1916">Congratulations${first ? `, ${escapeHtml(first)}` : ""}!</h1>
       <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#56655f">
         You've completed <strong style="color:#0b1916">${course}</strong>. Your certificate, issued by ${escapeHtml(company.legalName)}, is ready to download and add to LinkedIn.
       </p>
       ${button(listUrl, "View your certificate")}
       <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#56655f">
         Certificate ${escapeHtml(cert.serial)}. Anyone can check it at <a href="${verifyUrl}" style="color:#2a524a">${escapeHtml(verifyUrl.replace(/^https?:\/\//, ""))}</a>.
       </p>`,
      `<p style="margin:0">You received this because you completed a course with ${escapeHtml(site.name)}.</p>`,
    ),
    text: `Congratulations! You've completed ${row.courseTitle}.\n\nYour certificate (${cert.serial}): ${listUrl}\nVerify it: ${verifyUrl}`,
  });
}

export type NudgeCandidate = { enrollmentId: string; userId: string; lastActivity: Date; nudgedAt: Date | null };

/**
 * Which learners to nudge. An enrolment is due when its last activity is more than
 * IDLE_DAYS ago and it has not been nudged since that activity. One email per learner,
 * about their most recently active due course; all their due enrolments count as nudged
 * (one email per break, not one per course per day). Most recently active first, capped.
 */
export function pickNudges<T extends NudgeCandidate>(rows: T[], now: Date, limit = NUDGE_BATCH) {
  const cutoff = now.getTime() - IDLE_DAYS * DAY_MS;
  const byUser = new Map<string, T[]>();
  for (const r of rows) {
    if (r.lastActivity.getTime() >= cutoff || (r.nudgedAt && r.nudgedAt >= r.lastActivity)) continue;
    byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  }
  return [...byUser.values()]
    .map((due) => {
      due.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      return { primary: due[0], enrollmentIds: due.map((r) => r.enrollmentId) };
    })
    .sort((a, b) => b.primary.lastActivity.getTime() - a.primary.lastActivity.getTime())
    .slice(0, limit);
}

/** The daily idle-learner run (GET /api/cron/nudge). Returns counts for the cron log. */
export async function sendNudges(now = new Date()) {
  // Active, unexpired enrolments in courses the learner has not finished (or been certified in).
  // ponytail: scans every such enrolment; push the idle cutoff into SQL when this gets large.
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      userId: enrollments.userId,
      courseId: enrollments.courseId,
      nudgedAt: enrollments.nudgedAt,
      lastActivity: sql<Date>`greatest(max(${lessonProgress.updatedAt}), ${enrollments.startedAt})`.mapWith(
        enrollments.startedAt,
      ),
      email: user.email,
      courseSlug: courses.slug,
      courseTitle: courses.title,
    })
    .from(enrollments)
    .innerJoin(user, eq(user.id, enrollments.userId))
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(lessons, and(eq(lessons.courseId, enrollments.courseId), lessonReady))
    .leftJoin(lessonProgress, and(eq(lessonProgress.lessonId, lessons.id), eq(lessonProgress.userId, enrollments.userId)))
    .where(
      and(
        eq(enrollments.status, "active"),
        // Partner learners learn on the client's platform and have unreachable .invalid emails.
        ne(enrollments.source, "distributor"),
        or(isNull(enrollments.expiresAt), gt(enrollments.expiresAt, now)),
        sql`not exists (select 1 from ${certificates} where ${certificates.userId} = ${enrollments.userId} and ${certificates.courseId} = ${enrollments.courseId})`,
      ),
    )
    .groupBy(enrollments.id, user.id, courses.id)
    .having(sql`count(${lessonProgress.completedAt}) < count(${lessons.id})`);

  const picks = pickNudges(rows, now);
  if (picks.length === 0) return { candidates: rows.length, sent: 0 };
  const mail = await nextOnly();
  let sent = 0;
  for (const { primary: r, enrollmentIds } of picks) {
    // Claim first, conditionally, so overlapping runs cannot both send.
    const claimed = await db
      .update(enrollments)
      .set({ nudgedAt: now })
      .where(
        and(
          eq(enrollments.id, r.enrollmentId),
          or(isNull(enrollments.nudgedAt), lt(enrollments.nudgedAt, r.lastActivity)),
        ),
      )
      .returning({ id: enrollments.id });
    if (claimed.length === 0) continue;
    await db.update(enrollments).set({ nudgedAt: now }).where(inArray(enrollments.id, enrollmentIds));

    const progress = await db
      .select({ lessonId: lessonProgress.lessonId, completedAt: lessonProgress.completedAt })
      .from(lessonProgress)
      .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
      .where(and(eq(lessonProgress.userId, r.userId), eq(lessons.courseId, r.courseId), isNotNull(lessonProgress.completedAt)));
    const next = nextIncompleteLesson(await getCourseOutline(r.courseId), progress);
    if (!next) continue;

    // ponytail: sequential and spaced for Resend's default 2 requests/s; use its batch endpoint if the cap grows.
    if (sent > 0) await new Promise((resolve) => setTimeout(resolve, 600));
    await sendNudgeEmail({ ...r, lessonSlug: next.slug, lessonTitle: next.title }, mail);
    sent++;
  }
  return { candidates: rows.length, sent };
}

async function sendNudgeEmail(
  n: { email: string; courseSlug: string; courseTitle: string; lessonSlug: string; lessonTitle: string },
  { shell, escapeHtml, site }: Awaited<ReturnType<typeof nextOnly>>,
) {
  const url = `${site.url}/learn/${n.courseSlug}/${n.lessonSlug}`;
  await sendEmail({
    from: from(site.name),
    to: [n.email],
    reply_to: site.email,
    subject: `Pick up where you left off: ${n.lessonTitle}`,
    html: shell(
      `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b1916">Pick up where you left off</h1>
       <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#56655f">
         Your next lesson in <strong style="color:#0b1916">${escapeHtml(n.courseTitle)}</strong> is
         <strong style="color:#0b1916">${escapeHtml(n.lessonTitle)}</strong>. A few minutes today keeps the momentum going.
       </p>
       ${button(url, "Continue learning")}`,
      `<p style="margin:0">You received this because you're enrolled in ${escapeHtml(n.courseTitle)}. We send one reminder per break, never more.</p>`,
    ),
    text: `Pick up where you left off: ${n.lessonTitle} in ${n.courseTitle}.\n\n${url}`,
  });
}
