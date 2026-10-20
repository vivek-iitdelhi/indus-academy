import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { certificates, courses, enrollments, lessons, payments, quizAttempts, user } from "@/db/schema";
import { completionPercent, completionSql, formatDate, formatDateTime, formatRupees, toDateInput } from "@/lib/admin/ops";
import { requireAdmin } from "@/lib/session";
import { ActionForm } from "../action-form";
import { grantEnrolment, setEnrolmentExpiry, setEnrolmentStatus, updateName } from "../actions";
import { Badge, btn, btnDark, input, PageTitle, SectionTitle, Table } from "../admin-ui";

const toDate = (v: string | null) => (v ? new Date(v) : null);

export default async function AdminLearnerPage({ params }: PageProps<"/admin/learners/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [learner] = await db.select().from(user).where(eq(user.id, id));
  if (!learner) notFound();

  const [enrolments, quizzes, certs, pays, allCourses] = await Promise.all([
    db
      .select({
        id: enrollments.id,
        courseTitle: courses.title,
        source: enrollments.source,
        status: enrollments.status,
        startedAt: enrollments.startedAt,
        expiresAt: enrollments.expiresAt,
        ...completionSql(enrollments.userId, enrollments.courseId),
        lastActivity: sql<string | null>`(select max(lp.updated_at) from lesson_progress lp join lessons l on l.id = lp.lesson_id
          where lp.user_id = ${enrollments.userId} and l.course_id = ${enrollments.courseId})`,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, id))
      .orderBy(desc(enrollments.startedAt)),
    db
      .select({
        lessonId: lessons.id,
        lesson: lessons.title,
        course: courses.title,
        attempts: sql<number>`count(*)::int`,
        best: sql<number>`max(${quizAttempts.scorePercent})`,
        passed: sql<boolean>`bool_or(${quizAttempts.passed})`,
      })
      .from(quizAttempts)
      .innerJoin(lessons, eq(quizAttempts.lessonId, lessons.id))
      .innerJoin(courses, eq(lessons.courseId, courses.id))
      .where(eq(quizAttempts.userId, id))
      .groupBy(lessons.id, courses.id)
      .orderBy(asc(courses.title), asc(lessons.position)),
    db
      .select({ serial: certificates.serial, course: courses.title, holderName: certificates.holderName, issuedAt: certificates.issuedAt, revokedAt: certificates.revokedAt })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(eq(certificates.userId, id))
      .orderBy(desc(certificates.issuedAt)),
    db
      .select({ id: payments.id, course: courses.title, amountPaise: payments.amountPaise, status: payments.status, createdAt: payments.createdAt })
      .from(payments)
      .innerJoin(courses, eq(payments.courseId, courses.id))
      .where(eq(payments.userId, id))
      .orderBy(desc(payments.createdAt)),
    db.select({ id: courses.id, title: courses.title, status: courses.status }).from(courses).orderBy(asc(courses.title)),
  ]);
  const now = new Date();

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/learners" className="text-muted hover:text-ink">← Learners</Link>
      </p>
      <div className="mt-3">
        <PageTitle intro={learner.email}>{learner.name || "(no name)"}</PageTitle>
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Email</dt><dd className="mt-1">{learner.email}</dd></div>
          <div><dt className="text-muted">Phone</dt><dd className="mt-1">{learner.phone || "—"}</dd></div>
          <div><dt className="text-muted">Signed up</dt><dd className="mt-1">{formatDateTime(learner.createdAt)}</dd></div>
        </dl>
        <ActionForm action={updateName} className="mt-5 flex flex-wrap items-end gap-2">
          <input type="hidden" name="userId" value={learner.id} />
          <label className="text-sm">
            <span className="block text-muted">Name, as printed on certificates</span>
            <input name="name" defaultValue={learner.name} required maxLength={120} className={`${input} mt-1 w-72`} />
          </label>
          <button className={btn}>Save name</button>
          <p className="basis-full text-xs text-muted">
            Changing it does not alter certificates already issued; correct those under Certificates.
          </p>
        </ActionForm>
      </section>

      <SectionTitle>Enrolments</SectionTitle>
      <Table head={["Course", "Source", "Status", "Started", "Expires", "Progress", "Last activity", ""]} empty="No enrolments.">
        {enrolments.map((e) => {
          const expired = e.expiresAt !== null && e.expiresAt <= now;
          return (
            <tr key={e.id}>
              <td className="font-medium">{e.courseTitle}</td>
              <td>{e.source}</td>
              <td>
                {e.status === "revoked" ? <Badge tone="bad">revoked</Badge> : expired ? <Badge tone="warn">expired</Badge> : <Badge tone="good">active</Badge>}
              </td>
              <td className="whitespace-nowrap">{formatDate(e.startedAt)}</td>
              <td>
                <ActionForm action={setEnrolmentExpiry} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="enrolmentId" value={e.id} />
                  <input type="date" name="expires" defaultValue={toDateInput(e.expiresAt)} aria-label={`Expiry for ${e.courseTitle}`} className={input} />
                  <button className={btn}>Save</button>
                </ActionForm>
                <span className="mt-1 block text-xs text-muted">Empty = never expires</span>
              </td>
              <td className="whitespace-nowrap">
                {completionPercent(e.done, e.total)}% <span className="text-muted">({e.done}/{e.total})</span>
              </td>
              <td className="whitespace-nowrap">{formatDateTime(toDate(e.lastActivity))}</td>
              <td>
                <ActionForm
                  key={e.status}
                  action={setEnrolmentStatus}
                  confirm={e.status === "active" ? `Revoke access to ${e.courseTitle}?` : undefined}
                >
                  <input type="hidden" name="enrolmentId" value={e.id} />
                  <input type="hidden" name="status" value={e.status === "active" ? "revoked" : "active"} />
                  <button className={btn}>{e.status === "active" ? "Revoke" : "Reactivate"}</button>
                </ActionForm>
              </td>
            </tr>
          );
        })}
      </Table>

      <ActionForm action={grantEnrolment} className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white p-4">
        <input type="hidden" name="userId" value={learner.id} />
        <label className="text-sm">
          <span className="block text-muted">Grant access to</span>
          <select name="courseId" required className={`${input} mt-1`}>
            {allCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}{c.status !== "published" ? ` (${c.status})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-muted">Expires (optional)</span>
          <input type="date" name="expires" className={`${input} mt-1`} />
        </label>
        <button className={btnDark}>Grant enrolment</button>
      </ActionForm>

      <SectionTitle>Quiz attempts</SectionTitle>
      <Table head={["Course", "Quiz", "Attempts", "Best score", "Passed"]} empty="No quiz attempts.">
        {quizzes.map((q) => (
          <tr key={q.lessonId}>
            <td>{q.course}</td>
            <td>{q.lesson}</td>
            <td>{q.attempts}</td>
            <td>{q.best}%</td>
            <td>{q.passed ? <Badge tone="good">passed</Badge> : <Badge tone="warn">not yet</Badge>}</td>
          </tr>
        ))}
      </Table>

      <SectionTitle>Certificates</SectionTitle>
      <Table head={["Serial", "Course", "Holder name", "Issued", "Status"]} empty="No certificates.">
        {certs.map((c) => (
          <tr key={c.serial}>
            <td className="font-mono text-xs">
              <Link href={`/admin/certificates?q=${encodeURIComponent(c.serial)}`} className="underline">{c.serial}</Link>
            </td>
            <td>{c.course}</td>
            <td>{c.holderName}</td>
            <td className="whitespace-nowrap">{formatDate(c.issuedAt)}</td>
            <td>{c.revokedAt ? <Badge tone="bad">revoked</Badge> : <Badge tone="good">valid</Badge>}</td>
          </tr>
        ))}
      </Table>

      <SectionTitle>Payments</SectionTitle>
      <Table head={["Date", "Course", "Amount", "Status"]} empty="No payments.">
        {pays.map((p) => (
          <tr key={p.id}>
            <td className="whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
            <td>{p.course}</td>
            <td>{formatRupees(p.amountPaise)}</td>
            <td>{p.status}</td>
          </tr>
        ))}
      </Table>
      {pays.length > 0 && (
        <p className="mt-3 text-sm">
          <Link href={`/admin/payments?user=${encodeURIComponent(learner.id)}`} className="underline">Manage these payments and refunds</Link>
        </p>
      )}
    </div>
  );
}
