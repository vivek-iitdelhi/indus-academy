import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/app/admin/learners/action-form";
import { db } from "@/db";
import { distributors, type CertificateReleaseMode } from "@/db/schema";
import { isUuid } from "@/lib/distributors";
import { batchLearners, listBatches, waitingCertificates } from "@/lib/lms/partners";
import { requireAdmin } from "@/lib/session";
import { generateCertificates, renameLearnerAction, saveCertificateSettings, setBatchPayment } from "./actions";

const MODES: [CertificateReleaseMode, string][] = [
  ["on_payment", "After payment (when the batch is marked paid)"],
  ["on_completion", "As soon as the learner completes"],
  ["manual", "Only when I click Generate"],
];
const when = (date: Date | null) =>
  date ? date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "–";
const button = "h-9 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-pine";
const link = "text-sm font-medium text-pine underline underline-offset-4";

export default async function DistributorPage({ params, searchParams }: PageProps<"/admin/distributors/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [distributor] = await db.select().from(distributors).where(eq(distributors.id, id));
  if (!distributor) notFound();

  const { batch: openBatchId } = await searchParams;
  const [batches, waiting] = await Promise.all([listBatches(id), waitingCertificates(id)]);
  const openBatch = batches.find((b) => b.batch.id === openBatchId);
  const learners = openBatch ? await batchLearners(openBatch.batch.id) : [];

  return (
    <div>
      <Link href="/admin/distributors" className={link}>
        ← Distributors
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{distributor.name}</h1>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Certificates</h2>
        <ActionForm
          action={saveCertificateSettings}
          confirm={
            waiting
              ? `${waiting} completed learner${waiting === 1 ? " is" : "s are"} waiting for a certificate. If the new setting allows it, they are issued now.`
              : undefined
          }
          className="mt-4 grid max-w-xl gap-4"
        >
          <input type="hidden" name="distributorId" value={id} />
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Certificate name</span>
            <input
              name="certificateName"
              defaultValue={distributor.certificateName ?? ""}
              maxLength={120}
              placeholder="e.g. TCS (leave empty for our plain certificate)"
              className="h-10 rounded-xl border border-line px-3"
            />
            <span className="text-muted">Printed as “Delivered in partnership with …”.</span>
          </label>
          <fieldset className="grid gap-2 text-sm">
            <legend className="font-medium">Generate certificates</legend>
            {MODES.map(([value, label]) => (
              <label key={value} className="flex items-center gap-3">
                <input type="radio" name="mode" value={value} defaultChecked={distributor.certificateRelease === value} />
                {label}
              </label>
            ))}
          </fieldset>
          <div>
            <button className={button}>Save</button>
          </div>
        </ActionForm>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Batches</h2>
        {batches.length === 0 && <p className="mt-3 text-sm text-muted">No batches yet. They appear when the client reports completions.</p>}
        <ul className="mt-4 grid gap-3">
          {batches.map(({ batch, learners: count, completed, released }) => {
            const paid = batch.paidAt !== null;
            const waitingHere = completed - released;
            return (
              <li key={batch.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3 text-sm">
                <Link href={`?batch=${batch.id}`} className="font-semibold underline underline-offset-4">
                  {batch.name}
                </Link>
                <span>{count} learners</span>
                <span>{completed} completed</span>
                <span>{released} released</span>
                <span className="text-muted">{paid ? `Paid ${when(batch.paidAt)} by ${batch.paidBy}` : "Not paid"}</span>
                <ActionForm
                  action={setBatchPayment}
                  confirm={
                    paid
                      ? `Mark ${batch.name} as not paid? Certificates already released stay valid.`
                      : `Mark ${batch.name} as paid${distributor.certificateRelease === "on_payment" && waitingHere ? ` and release ${waitingHere} certificates` : ""}?`
                  }
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="batchId" value={batch.id} />
                  <input type="hidden" name="paid" value={paid ? "0" : "1"} />
                  <button className={paid ? link : button}>{paid ? "Mark not paid" : "Payment received"}</button>
                </ActionForm>
                {waitingHere > 0 && (
                  <ActionForm
                    action={generateCertificates}
                    confirm={`Generate ${waitingHere} certificates for ${batch.name} now, whether or not it is paid?`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="distributorId" value={id} />
                    <input type="hidden" name="batchId" value={batch.id} />
                    <button className={link}>Generate {waitingHere} now</button>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {openBatch && (
        <section className="mt-8 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">{openBatch.batch.name}: learners</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted">
              <tr>
                <th className="py-2">Name</th>
                <th>Their id</th>
                <th>Course</th>
                <th>Completed</th>
                <th>Certificate</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((l) => (
                <tr key={l.enrollmentId} className="border-t border-line align-top">
                  <td className="py-2">
                    <ActionForm action={renameLearnerAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="distributorId" value={id} />
                      <input type="hidden" name="userId" value={l.userId} />
                      <input name="name" defaultValue={l.name} maxLength={120} className="h-8 rounded-lg border border-line px-2" />
                      <button className={link}>Save</button>
                    </ActionForm>
                  </td>
                  <td className="font-mono text-xs">{l.externalId}</td>
                  <td>{l.courseTitle}</td>
                  <td>{when(l.completedAt)}</td>
                  <td>
                    {l.certificate ? (
                      <a href={`/verify/${l.certificate.serial}`} className={link}>
                        {l.certificate.serial}
                        {l.certificate.revokedAt ? " (revoked)" : ""}
                      </a>
                    ) : l.completedAt ? (
                      <ActionForm action={generateCertificates} confirm={`Generate ${l.name}'s certificate now?`}>
                        <input type="hidden" name="distributorId" value={id} />
                        <input type="hidden" name="enrollmentId" value={l.enrollmentId} />
                        <button className={link}>Generate now</button>
                      </ActionForm>
                    ) : (
                      "Not completed"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
