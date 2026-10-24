import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, paymentStatuses, payments, user, type PaymentStatus } from "@/db/schema";
import { completionPercent, completionSql, formatDateTime, formatRupees, REFUND_LIMIT_PERCENT, REFUND_WINDOW_HOURS, refundBlocker } from "@/lib/admin/ops";
import { requireAdmin } from "@/lib/session";
import { ActionForm } from "../learners/action-form";
import { Badge, btn, PAGE_SIZE, PageTitle, Pager, pageParam, param, Table } from "../learners/admin-ui";
import { refund } from "./actions";

const statusTone = { created: "muted", paid: "good", failed: "bad", refunded: "warn" } as const;

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = paymentStatuses.find((s) => s === param(sp.status)) as PaymentStatus | undefined;
  const userId = param(sp.user);
  const page = pageParam(sp.page);

  const rows = await db
    .select({
      id: payments.id,
      createdAt: payments.createdAt,
      amountPaise: payments.amountPaise,
      couponCode: payments.couponCode,
      status: payments.status,
      orderId: payments.orderId,
      paymentId: payments.paymentId,
      refundId: payments.refundId,
      userId: payments.userId,
      email: user.email,
      name: user.name,
      course: courses.title,
      ...completionSql(payments.userId, payments.courseId),
    })
    .from(payments)
    .innerJoin(courses, eq(payments.courseId, courses.id))
    .leftJoin(user, eq(payments.userId, user.id))
    .where(and(status ? eq(payments.status, status) : undefined, userId ? eq(payments.userId, userId) : undefined))
    .orderBy(desc(payments.createdAt), payments.id)
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  const filterHref = (s?: string) => `/admin/payments?${new URLSearchParams({ ...(s && { status: s }), ...(userId && { user: userId }) })}`;
  const params = { ...(status && { status }), ...(userId && { user: userId }) };

  return (
    <div>
      <PageTitle
        intro={`Refund policy: a full refund if asked within ${REFUND_WINDOW_HOURS} hours of purchase and before ${REFUND_LIMIT_PERCENT}% of the course is complete.`}
      >
        Payments
      </PageTitle>
      <nav aria-label="Filter by status" className="mt-6 flex flex-wrap items-center gap-2">
        {[undefined, ...paymentStatuses].map((s) => (
          <Link
            key={s ?? "all"}
            href={filterHref(s)}
            aria-current={s === status ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${s === status ? "bg-ink text-paper" : "border border-ink/15 hover:border-ink/40"}`}
          >
            {s ?? "all"}
          </Link>
        ))}
        {userId && (
          <Link href={status ? `/admin/payments?status=${status}` : "/admin/payments"} className="text-sm text-muted underline">
            Showing one learner · show everyone
          </Link>
        )}
      </nav>

      <Table head={["Date", "Learner", "Course", "Amount", "Status", "Cashfree", "Refund"]} empty="No payments.">
        {rows.slice(0, PAGE_SIZE).map((p) => {
          const percent = completionPercent(p.done, p.total);
          const blocker = refundBlocker(p.done, p.total, p.createdAt);
          const eligible = !blocker;
          return (
            <tr key={p.id}>
              <td className="whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
              <td>
                {p.userId ? (
                  <Link href={`/admin/learners/${p.userId}`} className="underline-offset-4 hover:underline">
                    {p.name || p.email}
                    {p.name && <span className="block text-xs text-muted">{p.email}</span>}
                  </Link>
                ) : (
                  <span className="text-muted">Deleted account</span>
                )}
              </td>
              <td>{p.course}</td>
              <td className="whitespace-nowrap">
                {formatRupees(p.amountPaise)}
                {p.couponCode && <span className="block font-mono text-xs text-muted">{p.couponCode}</span>}
              </td>
              <td><Badge tone={statusTone[p.status]}>{p.status}</Badge></td>
              <td className="font-mono text-xs leading-relaxed">
                {p.orderId}
                {p.paymentId && <span className="block">{p.paymentId}</span>}
                {p.refundId && <span className="block text-muted">{p.refundId}</span>}
              </td>
              <td>
                {p.status === "paid" && (
                  <div className="flex flex-col items-start gap-2">
                    <Badge tone={eligible ? "good" : "bad"}>
                      {eligible ? `eligible (${percent}% complete)` : `not eligible: ${blocker}`}
                    </Badge>
                    <ActionForm
                      action={refund}
                      confirm={`Refund ${formatRupees(p.amountPaise)} in full to ${p.email ?? "this learner"} and revoke their access to ${p.course}?`}
                      override={
                        eligible
                          ? undefined
                          : `Outside the refund policy (${blocker}). Override the policy and refund anyway?`
                      }
                      className="flex flex-col items-start gap-1"
                    >
                      <input type="hidden" name="paymentId" value={p.id} />
                      <button className={btn}>Refund</button>
                    </ActionForm>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
      <Pager path="/admin/payments" params={params} page={page} hasMore={rows.length > PAGE_SIZE} />
    </div>
  );
}
