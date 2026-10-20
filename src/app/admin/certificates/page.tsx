import Link from "next/link";
import { asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { certificates, courses, user } from "@/db/schema";
import { formatDate } from "@/lib/admin/ops";
import { requireAdmin } from "@/lib/session";
import { ActionForm } from "../learners/action-form";
import { Badge, btn, btnDark, input, PAGE_SIZE, PageTitle, Pager, pageParam, param, SectionTitle, Table } from "../learners/admin-ui";
import { issueManually, renameHolder, setCertificateRevoked } from "./actions";

export default async function AdminCertificatesPage({ searchParams }: PageProps<"/admin/certificates">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp.q).trim();
  const page = pageParam(sp.page);
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

  const [rows, allCourses] = await Promise.all([
    db
      .select({
        serial: certificates.serial,
        holderName: certificates.holderName,
        issuedAt: certificates.issuedAt,
        revokedAt: certificates.revokedAt,
        userId: certificates.userId,
        email: user.email,
        course: courses.title,
      })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .innerJoin(user, eq(certificates.userId, user.id))
      .where(q ? or(ilike(certificates.serial, pattern), ilike(certificates.holderName, pattern), ilike(user.email, pattern)) : undefined)
      .orderBy(desc(certificates.issuedAt), certificates.serial)
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ id: courses.id, title: courses.title }).from(courses).orderBy(asc(courses.title)),
  ]);

  return (
    <div>
      <PageTitle intro="Revoking never deletes: the public verification page answers “revoked”.">Certificates</PageTitle>
      <form className="mt-6 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Serial, name or email" aria-label="Search certificates" className={`${input} w-72`} />
        <button className={btn}>Search</button>
        {q && <Link href="/admin/certificates" className={btn}>Clear</Link>}
      </form>

      <Table head={["Serial", "Holder", "Course", "Issued", "Status", ""]} empty={q ? "No certificates match." : "No certificates yet."}>
        {rows.slice(0, PAGE_SIZE).map((c) => (
          <tr key={c.serial}>
            <td className="whitespace-nowrap font-mono text-xs">
              <Link href={`/verify/${c.serial}`} className="underline" target="_blank">{c.serial}</Link>
            </td>
            <td>
              <ActionForm action={renameHolder} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="serial" value={c.serial} />
                <input name="holderName" defaultValue={c.holderName} required maxLength={120} aria-label={`Holder name on ${c.serial}`} className={`${input} w-52`} />
                <button className={btn}>Correct</button>
              </ActionForm>
              <Link href={`/admin/learners/${c.userId}`} className="mt-1 block text-xs text-muted hover:text-ink">{c.email}</Link>
            </td>
            <td>{c.course}</td>
            <td className="whitespace-nowrap">{formatDate(c.issuedAt)}</td>
            <td>
              {c.revokedAt ? <Badge tone="bad">revoked {formatDate(c.revokedAt)}</Badge> : <Badge tone="good">valid</Badge>}
            </td>
            <td>
              <ActionForm
                key={String(c.revokedAt)}
                action={setCertificateRevoked}
                confirm={c.revokedAt ? undefined : `Revoke ${c.serial}? Verification will show it as revoked.`}
              >
                <input type="hidden" name="serial" value={c.serial} />
                <input type="hidden" name="revoke" value={c.revokedAt ? "" : "1"} />
                <button className={btn}>{c.revokedAt ? "Reinstate" : "Revoke"}</button>
              </ActionForm>
            </td>
          </tr>
        ))}
      </Table>
      <Pager path="/admin/certificates" params={q ? { q } : {}} page={page} hasMore={rows.length > PAGE_SIZE} />

      <SectionTitle>Issue manually</SectionTitle>
      <p className="mt-1 text-sm text-muted">Issues with the learner’s current name, whether or not they finished the course.</p>
      <ActionForm action={issueManually} className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white p-4">
        <label className="text-sm">
          <span className="block text-muted">Learner email</span>
          <input type="email" name="email" required className={`${input} mt-1 w-64`} />
        </label>
        <label className="text-sm">
          <span className="block text-muted">Course</span>
          <select name="courseId" required className={`${input} mt-1`}>
            {allCourses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </label>
        <button className={btnDark}>Issue certificate</button>
      </ActionForm>
    </div>
  );
}
