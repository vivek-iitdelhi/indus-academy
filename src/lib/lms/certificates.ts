import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
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

/**
 * Issues the learner's certificate for a course, or returns the one they already have
 * (revoked or not). Safe to call repeatedly and concurrently. Does not check completion;
 * call it through onLessonCompleted (completion.ts) or an admin action.
 */
export async function issueCertificate(userId: string, courseId: string): Promise<Certificate> {
  const existing = await findCertificate(userId, courseId);
  if (existing) return existing;

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
  // Lost a race: another request issued it first (the sequence number is skipped).
  return inserted ?? (await findCertificate(userId, courseId))!;
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
