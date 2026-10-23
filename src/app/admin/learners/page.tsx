import Link from "next/link";
import { and, desc, eq, ilike, notExists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { enrollments, partnerLearners, user } from "@/db/schema";
import { formatDate } from "@/lib/admin/ops";
import { requireAdmin } from "@/lib/session";
import { btn, input, PAGE_SIZE, PageTitle, Pager, pageParam, param, Table } from "./admin-ui";

export default async function AdminLearnersPage({ searchParams }: PageProps<"/admin/learners">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp.q).trim();
  const page = pageParam(sp.page);
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      enrolments: sql<number>`count(${enrollments.id})::int`,
    })
    .from(user)
    .leftJoin(enrollments, eq(enrollments.userId, user.id))
    .where(
      and(
        // Partner learners are managed on their distributor's page.
        notExists(db.select({ one: sql`1` }).from(partnerLearners).where(eq(partnerLearners.userId, user.id))),
        q ? or(ilike(user.email, pattern), ilike(user.name, pattern)) : undefined,
      ),
    )
    .groupBy(user.id)
    .orderBy(desc(user.createdAt), user.id)
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div>
      <PageTitle>Learners</PageTitle>
      <form className="mt-6 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Email or name" aria-label="Search learners" className={`${input} w-72`} />
        <button className={btn}>Search</button>
        {q && <Link href="/admin/learners" className={btn}>Clear</Link>}
      </form>
      <Table head={["Name", "Email", "Signed up", "Enrolments"]} empty={q ? "No learners match." : "No learners yet."}>
        {rows.slice(0, PAGE_SIZE).map((row) => (
          <tr key={row.id}>
            <td>
              <Link href={`/admin/learners/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                {row.name || <span className="text-muted">(no name)</span>}
              </Link>
            </td>
            <td>
              <Link href={`/admin/learners/${row.id}`} className="underline-offset-4 hover:underline">{row.email}</Link>
            </td>
            <td className="whitespace-nowrap">{formatDate(row.createdAt)}</td>
            <td>{row.enrolments}</td>
          </tr>
        ))}
      </Table>
      <Pager path="/admin/learners" params={q ? { q } : {}} page={page} hasMore={rows.length > PAGE_SIZE} />
    </div>
  );
}
