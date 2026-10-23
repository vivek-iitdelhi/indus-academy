import { asc, desc } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";
import { db } from "@/db";
import { courses, distributorCourses, distributors } from "@/db/schema";
import { ActionForm } from "@/app/admin/learners/action-form";
import { usageByDistributor } from "@/lib/api-usage";
import { requireAdmin } from "@/lib/session";
import { setDistributorStatus, setLicensedCourses } from "./actions";
import { CreateDistributorForm, RotateKeyForm } from "./key-forms";

const when = (date: Date | null) =>
  date ? date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "Never";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

export default async function AdminDistributorsPage() {
  await requireAdmin();
  const [rows, licences, allCourses, requests7d] = await Promise.all([
    db.select().from(distributors).orderBy(desc(distributors.createdAt)),
    db.select().from(distributorCourses),
    db.select({ id: courses.id, title: courses.title, status: courses.status }).from(courses).orderBy(asc(courses.title)),
    usageByDistributor(7),
  ]);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Distributors</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Partner platforms that receive licensed courses over the API (<code>docs/distributor-api.md</code>). They see
        only licensed courses that are published. Usage, learners and certificates for every client side by side:{" "}
        <Link href="/admin/analytics" className="text-pine underline underline-offset-4">
          Partner analytics
        </Link>
        .
      </p>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">New distributor</h2>
        <div className="mt-4">
          <CreateDistributorForm />
        </div>
      </section>

      {rows.length === 0 && <p className="mt-8 text-muted">No distributors yet.</p>}
      <ul className="mt-8 grid gap-4">
        {rows.map((d) => {
          const licensed = new Set(licences.filter((l) => l.distributorId === d.id).map((l) => l.courseId));
          const active = d.status === "active";
          return (
            <li key={d.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{d.name}</h2>
                  <p className="text-sm text-muted">{d.contactEmail ?? "No contact email"}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] ${
                    active ? "bg-mint text-ink" : "bg-ink/10 text-muted"
                  }`}
                >
                  {d.status}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-5">
                <Fact label="Key">
                  <code className="font-mono text-xs">{d.keyPrefix}…</code>
                </Fact>
                <Fact label="Licensed courses">{d.allCourses ? "All courses" : licensed.size}</Fact>
                <Fact label="Created">{when(d.createdAt)}</Fact>
                <Fact label="Last used">{when(d.lastUsedAt)}</Fact>
                <Fact label="Requests (7 days)">{(requests7d.get(d.id)?.requests ?? 0).toLocaleString("en-IN")}</Fact>
              </dl>

              <div className="mt-4 flex flex-wrap items-start gap-6">
                <Link href={`/admin/distributors/${d.id}`} className="text-sm font-medium text-pine underline underline-offset-4">
                  API usage, learners &amp; certificates
                </Link>
                <RotateKeyForm id={d.id} name={d.name} />
                <ActionForm
                  action={setDistributorStatus}
                  confirm={active ? `Revoke ${d.name}'s access? Their API key stops working immediately.` : undefined}
                  className="flex flex-wrap items-center gap-3"
                >
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="status" value={active ? "revoked" : "active"} />
                  <button className="text-sm font-medium text-pine underline underline-offset-4">
                    {active ? "Revoke access" : "Reactivate"}
                  </button>
                </ActionForm>
              </div>

              <details className="mt-4 border-t border-line pt-4">
                <summary className="cursor-pointer text-sm font-medium">Edit courses</summary>
                <ActionForm action={setLicensedCourses} className="mt-3 flex flex-col items-start">
                  <input type="hidden" name="id" value={d.id} />
                  <fieldset className="mb-4 grid gap-2 text-sm">
                    <legend className="sr-only">Which courses {d.name} gets</legend>
                    <label className="flex items-center gap-3">
                      <input type="radio" name="scope" value="all" defaultChecked={d.allCourses} />
                      <span>
                        <span className="font-medium">All courses</span>, including ones published later
                      </span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="radio" name="scope" value="selected" defaultChecked={!d.allCourses} />
                      <span>Only the courses ticked below</span>
                    </label>
                  </fieldset>
                  <fieldset className="grid gap-2">
                    <legend className="sr-only">Licensed courses for {d.name}</legend>
                    {allCourses.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 text-sm">
                        <input type="checkbox" name="courseId" value={c.id} defaultChecked={licensed.has(c.id)} />
                        <span>{c.title}</span>
                        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{c.status}</span>
                      </label>
                    ))}
                  </fieldset>
                  <button className="mt-4 h-10 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-pine">
                    Save courses
                  </button>
                </ActionForm>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
