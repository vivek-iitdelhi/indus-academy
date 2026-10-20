import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates, courses, enrollments, payments, user } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

async function countOf(query: Promise<{ n: number }[]>) {
  const [row] = await query;
  return row.n;
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [courseCount, learnerCount, enrollmentCount, paidCount, certificateCount] = await Promise.all([
    countOf(db.select({ n: count() }).from(courses)),
    countOf(db.select({ n: count() }).from(user)),
    countOf(db.select({ n: count() }).from(enrollments).where(eq(enrollments.status, "active"))),
    countOf(db.select({ n: count() }).from(payments).where(eq(payments.status, "paid"))),
    countOf(db.select({ n: count() }).from(certificates)),
  ]);
  const stats = [
    { label: "Courses", value: courseCount },
    { label: "Learners", value: learnerCount },
    { label: "Active enrolments", value: enrollmentCount },
    { label: "Paid orders", value: paidCount },
    { label: "Certificates", value: certificateCount },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Overview</h1>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-white p-5">
            <dt className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted">{stat.label}</dt>
            <dd className="mt-3 text-3xl font-semibold tracking-tight">{stat.value.toLocaleString("en-IN")}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
