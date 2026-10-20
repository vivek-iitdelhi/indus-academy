import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { certificates, courses, user, type Certificate } from "../../db/schema.ts";

/** IAA-<year>-<n>, n zero-padded to at least 4 digits. */
export const formatSerial = (year: number, n: number) => `IAA-${year}-${String(n).padStart(4, "0")}`;

type HashFields = Pick<Certificate, "serial" | "userId" | "courseId" | "issuedAt">;

/** HMAC-SHA256 over serial|user_id|course_id|issued_at ISO, hex. */
export function certificateHash(cert: HashFields, secret = process.env.CERTIFICATE_SECRET): string {
  if (!secret) throw new Error("CERTIFICATE_SECRET is not set");
  return createHmac("sha256", secret)
    .update(`${cert.serial}|${cert.userId}|${cert.courseId}|${cert.issuedAt.toISOString()}`)
    .digest("hex");
}

/** True when the stored hash matches the certificate's fields (i.e. it was not edited). */
export function verifyCertificateHash(cert: HashFields & Pick<Certificate, "hash">, secret?: string): boolean {
  const given = Buffer.from(cert.hash);
  const want = Buffer.from(certificateHash(cert, secret));
  return given.length === want.length && timingSafeEqual(given, want);
}

const yearInIndia = (date: Date) =>
  Number(date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata", year: "numeric" }));

/** "20 October 2026": the calendar date in India. */
export const formatIssueDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

/**
 * LinkedIn's "Add to profile" link, prefilled. Uses the company page id when we have one,
 * else the organisation name (LinkedIn then shows it without a logo).
 */
export function linkedInAddUrl(p: {
  courseTitle: string;
  serial: string;
  issuedAt: Date;
  certUrl: string;
  organizationId?: string;
  organizationName: string;
}): string {
  const [year, month] = p.issuedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-");
  const params = {
    startTask: "CERTIFICATION_NAME",
    name: p.courseTitle,
    ...(p.organizationId ? { organizationId: p.organizationId } : { organizationName: p.organizationName }),
    issueYear: year,
    issueMonth: String(Number(month)),
    certUrl: p.certUrl,
    certId: p.serial,
  };
  const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return `https://www.linkedin.com/profile/add?${query.join("&")}`;
}

/**
 * Issues the learner's certificate for a course, or returns the one they already have
 * (revoked or not). Safe to call repeatedly and concurrently. Does not check completion;
 * call it through onLessonCompleted (completion.ts) or an admin action.
 */
export async function issueCertificate(userId: string, courseId: string): Promise<Certificate> {
  return (await issueOrGetCertificate(userId, courseId)).certificate;
}

/** issueCertificate, also saying whether this call minted it (`issued`) or it already existed. */
export async function issueOrGetCertificate(
  userId: string,
  courseId: string,
): Promise<{ certificate: Certificate; issued: boolean }> {
  const existing = await findCertificate(userId, courseId);
  if (existing) return { certificate: existing, issued: false };

  const [holder] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
  if (!holder) throw new Error(`No user ${userId}`);

  const [{ n }] = await db.execute<{ n: string }>(sql`select nextval('certificate_serial_seq') as n`);
  const issuedAt = new Date(); // millisecond precision round-trips through timestamptz
  const fields = { serial: formatSerial(yearInIndia(issuedAt), Number(n)), userId, courseId, issuedAt };

  const [inserted] = await db
    .insert(certificates)
    .values({ ...fields, holderName: holder.name, hash: certificateHash(fields) })
    .onConflictDoNothing({ target: [certificates.userId, certificates.courseId] })
    .returning();
  if (inserted) return { certificate: inserted, issued: true };
  // Lost a race: another request issued it first (the sequence number is skipped).
  return { certificate: (await findCertificate(userId, courseId))!, issued: false };
}

async function findCertificate(userId: string, courseId: string) {
  const [row] = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)));
  return row ?? null;
}

/** A certificate by serial with its course, for the public verification page. */
export async function getCertificate(serial: string) {
  const [row] = await db
    .select({ certificate: certificates, courseTitle: courses.title, courseSlug: courses.slug })
    .from(certificates)
    .innerJoin(courses, eq(certificates.courseId, courses.id))
    .where(eq(certificates.serial, serial));
  return row ?? null;
}

/** The learner's certificates, newest first, revoked included. */
export async function listCertificates(userId: string) {
  return db
    .select({ certificate: certificates, courseTitle: courses.title, courseSlug: courses.slug })
    .from(certificates)
    .innerJoin(courses, eq(certificates.courseId, courses.id))
    .where(eq(certificates.userId, userId))
    .orderBy(desc(certificates.issuedAt));
}

/**
 * Sets the printed name on the learner's own certificate, only while it is still empty
 * (the name is not part of the hash). Also fills an empty account name so later
 * certificates get it. Returns false if there was nothing to set.
 */
export async function setEmptyHolderName(userId: string, serial: string, name: string): Promise<boolean> {
  const set = await db
    .update(certificates)
    .set({ holderName: name })
    .where(
      and(eq(certificates.serial, serial), eq(certificates.userId, userId), sql`trim(${certificates.holderName}) = ''`),
    )
    .returning({ serial: certificates.serial });
  if (set.length === 0) return false;
  await db.update(user).set({ name }).where(and(eq(user.id, userId), sql`trim(${user.name}) = ''`));
  return true;
}
