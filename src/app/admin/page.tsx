import Link from "next/link";
import { and, desc, eq, lt, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { courses, enrollments, payments, user } from "@/db/schema";
import { formatDateTime, formatRupees } from "@/lib/admin/ops";
import { requireAdmin } from "@/lib/session";
import { Badge, SectionTitle, Table } from "./learners/admin-ui";
import { SetupStatus } from "./setup-status";

type Stats = {
  signups: number; signups30: number;
  paid: number; paid30: number;
  revenue: number; revenue30: number;
  refunds: number; refunds30: number;
  lessons: number; lessons30: number;
  courses: number; courses30: number;
  certs: number; certs30: number;
};

const recent = (column: string) => sql.raw(`${column} >= now() - interval '30 days'`);

async function loadStats() {
  const [stats] = await db.execute<Stats>(sql`
    with done as (
      select lp.user_id, l.course_id, count(*) as n, max(lp.completed_at) as last
      from lesson_progress lp join lessons l on l.id = lp.lesson_id
      where lp.completed_at is not null group by 1, 2
    ), totals as (select course_id, count(*) as n from lessons group by 1)
    select
      (select count(*)::int from "user") as signups,
      (select count(*)::int from "user" where ${recent("created_at")}) as "signups30",
      (select count(*)::int from payments where status = 'paid') as paid,
      (select count(*)::int from payments where status = 'paid' and ${recent("created_at")}) as "paid30",
      (select coalesce(sum(amount_paise), 0)::float8 from payments where status = 'paid') as revenue,
      (select coalesce(sum(amount_paise), 0)::float8 from payments where status = 'paid' and ${recent("created_at")}) as "revenue30",
      (select count(*)::int from payments where status = 'refunded') as refunds,
      (select count(*)::int from payments where status = 'refunded' and ${recent("updated_at")}) as "refunds30",
      (select count(*)::int from lesson_progress where completed_at is not null) as lessons,
      (select count(*)::int from lesson_progress where ${recent("completed_at")}) as "lessons30",
      (select count(*)::int from done join totals using (course_id) where done.n >= totals.n) as courses,
      (select count(*)::int from done join totals using (course_id) where done.n >= totals.n and ${recent("done.last")}) as "courses30",
      (select count(*)::int from certificates) as certs,
      (select count(*)::int from certificates where ${recent("issued_at")}) as "certs30"
  `);
  const bySource = await db
    .select({
      source: enrollments.source,
      total: sql<number>`count(*)::int`,
      recent: sql<number>`(count(*) filter (where ${recent("started_at")}))::int`,
    })
    .from(enrollments)
    .where(eq(enrollments.status, "active"))
    .groupBy(enrollments.source)
    .orderBy(enrollments.source);
  return { stats, bySource };
}

const paymentColumns = {
  id: payments.id,
  createdAt: payments.createdAt,
  amountPaise: payments.amountPaise,
  orderId: payments.razorpayOrderId,
  paymentId: payments.razorpayPaymentId,
  userId: payments.userId,
  email: user.email,
  course: courses.title,
};

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [{ stats, bySource }, unenrolled, abandoned] = await Promise.all([
    loadStats(),
    // Paid, but the learner has no active enrolment for the course: someone's money.
    db
      .select(paymentColumns)
      .from(payments)
      .innerJoin(courses, eq(payments.courseId, courses.id))
      .leftJoin(user, eq(payments.userId, user.id))
      .where(
        and(
          eq(payments.status, "paid"),
          notExists(
            db
              .select({ id: enrollments.id })
              .from(enrollments)
              .where(
                and(
                  eq(enrollments.userId, payments.userId),
                  eq(enrollments.courseId, payments.courseId),
                  eq(enrollments.status, "active"),
                ),
              ),
          ),
        ),
      )
      .orderBy(desc(payments.createdAt)),
    db
      .select(paymentColumns)
      .from(payments)
      .innerJoin(courses, eq(payments.courseId, courses.id))
      .leftJoin(user, eq(payments.userId, user.id))
      .where(and(eq(payments.status, "created"), lt(payments.createdAt, sql`now() - interval '1 hour'`)))
      .orderBy(desc(payments.createdAt))
      .limit(20),
  ]);

  const activeTotal = bySource.reduce((sum, row) => sum + row.total, 0);
  const activeRecent = bySource.reduce((sum, row) => sum + row.recent, 0);
  const cards = [
    { label: "Signups", all: stats.signups, last30: stats.signups30 },
    {
      label: "Active enrolments",
      all: activeTotal,
      last30: activeRecent,
      note: bySource.map((row) => `${row.source} ${row.total}`).join(" · ") || "none yet",
    },
    { label: "Paid orders", all: stats.paid, last30: stats.paid30 },
    { label: "Revenue", all: formatRupees(stats.revenue), last30: formatRupees(stats.revenue30), note: "paid orders, net of refunds" },
    { label: "Refunds", all: stats.refunds, last30: stats.refunds30 },
    { label: "Lessons completed", all: stats.lessons, last30: stats.lessons30 },
    { label: "Courses completed", all: stats.courses, last30: stats.courses30 },
    { label: "Certificates issued", all: stats.certs, last30: stats.certs30 },
  ];
  const fmt = (v: number | string) => (typeof v === "number" ? v.toLocaleString("en-IN") : v);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Overview</h1>
      <SetupStatus />
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-line bg-white p-5">
            <dt className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted">{card.label}</dt>
            <dd className="mt-3 text-3xl font-semibold tracking-tight">{fmt(card.all)}</dd>
            <dd className="mt-1 text-sm text-muted">
              {fmt(card.last30)} in the last 30 days
              {card.note && <span className="mt-1 block text-xs">{card.note}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <SectionTitle>Needs attention</SectionTitle>
      <h3 className="mt-6 flex items-center gap-2 font-medium">
        Paid without an active enrolment <Badge tone={unenrolled.length ? "bad" : "good"}>{unenrolled.length}</Badge>
      </h3>
      <p className="mt-1 text-sm text-muted">
        These learners paid but cannot open the course. Grant access from their learner page, or refund.
      </p>
      <Table head={["Paid", "Learner", "Course", "Amount", "Razorpay"]} empty="None. Every paid order has access.">
        {unenrolled.map((p) => (
          <tr key={p.id} className="bg-red-50/60">
            <td className="whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
            <td>{p.userId ? <Link href={`/admin/learners/${p.userId}`} className="underline">{p.email}</Link> : "Deleted account"}</td>
            <td>{p.course}</td>
            <td>{formatRupees(p.amountPaise)}</td>
            <td className="font-mono text-xs">{p.orderId}<br />{p.paymentId}</td>
          </tr>
        ))}
      </Table>

      <h3 className="mt-8 flex items-center gap-2 font-medium">
        Abandoned checkouts <Badge>{abandoned.length === 20 ? "20+" : abandoned.length}</Badge>
      </h3>
      <p className="mt-1 text-sm text-muted">Orders still at “created” after an hour. Informational: nobody was charged.</p>
      <Table head={["Started", "Learner", "Course", "Amount", "Order"]} empty="None.">
        {abandoned.map((p) => (
          <tr key={p.id}>
            <td className="whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
            <td>{p.userId ? <Link href={`/admin/learners/${p.userId}`} className="underline">{p.email}</Link> : "Deleted account"}</td>
            <td>{p.course}</td>
            <td>{formatRupees(p.amountPaise)}</td>
            <td className="font-mono text-xs">{p.orderId}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
