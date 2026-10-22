import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { company, companyAddress, site } from "@/content/site";
import { SAC_CODE, STATES } from "@/lib/gst";
import { getInvoice } from "@/lib/invoices";
import { formatRupees } from "@/lib/rupees";
import { PrintButton } from "./print-button";

// Anyone with the link can open it (it goes out by email), so keep it out of search.
export const metadata: Metadata = { title: "Tax invoice", robots: { index: false, follow: false } };

const state = (code: string) => `${STATES[code] ?? "Unknown"} (${code})`;

export default async function InvoicePage({ params }: PageProps<"/invoice/[id]">) {
  const inv = await getInvoice((await params).id);
  if (!inv) notFound();

  const issued = inv.issuedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const taxes: [string, number][] = inv.igstPaise
    ? [["IGST @ 18%", inv.igstPaise]]
    : [
        ["CGST @ 9%", inv.cgstPaise],
        ["SGST @ 9%", inv.sgstPaise],
      ];
  const label = "font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted";

  return (
    <Container className="max-w-3xl py-12 print:py-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-line bg-white p-8 text-sm sm:p-10 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="text-lg font-semibold">{company.legalName}</p>
            <p className="mt-1 max-w-xs leading-relaxed text-muted">{companyAddress}</p>
            <p className="mt-1">GSTIN: {inv.supplierGstin}</p>
            <p className="text-muted">
              {site.email} · {company.phone}
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-semibold tracking-tight">Tax invoice</h1>
            <p className="mt-2">
              <span className="text-muted">No.</span> {inv.number}
            </p>
            <p>
              <span className="text-muted">Date</span> {issued}
            </p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
          <div>
            <p className={label}>Billed to</p>
            <p className="mt-2 font-medium">{inv.buyerCompany ?? inv.buyerName}</p>
            {inv.buyerCompany && <p>Attn: {inv.buyerName}</p>}
            {inv.buyerAddress && <p className="leading-relaxed text-muted">{inv.buyerAddress}</p>}
            <p className="text-muted">{inv.buyerEmail}</p>
            {inv.buyerGstin && <p className="mt-1">GSTIN: {inv.buyerGstin}</p>}
          </div>
          <div className="sm:text-right">
            <p className={label}>Place of supply</p>
            <p className="mt-2">{state(inv.placeOfSupply)}</p>
            <p className={`${label} mt-4`}>Payment</p>
            <p className="mt-2">Paid online · {inv.paymentId}</p>
          </div>
        </section>

        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className={`${label} text-left`}>
              <th className="pb-3 font-normal">Description</th>
              <th className="pb-3 font-normal">SAC</th>
              <th className="pb-3 font-normal">Qty</th>
              <th className="pb-3 text-right font-normal">Taxable value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line">
              <td className="py-3 pr-4">{inv.description}</td>
              <td className="py-3 pr-4">{SAC_CODE}</td>
              <td className="py-3 pr-4">1</td>
              <td className="py-3 text-right">{formatRupees(inv.taxablePaise)}</td>
            </tr>
          </tbody>
          <tfoot>
            {taxes.map(([name, paise]) => (
              <tr key={name} className="border-t border-line">
                <td colSpan={3} className="py-2 text-right text-muted">
                  {name}
                </td>
                <td className="py-2 text-right">{formatRupees(paise)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-ink font-semibold">
              <td colSpan={3} className="py-3 text-right">
                Total paid
              </td>
              <td className="py-3 text-right">{formatRupees(inv.totalPaise)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-8 text-xs leading-relaxed text-muted">
          Tax is not payable on reverse charge. This is a computer-generated invoice and needs no signature.
        </p>
      </article>
    </Container>
  );
}
