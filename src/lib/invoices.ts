import { eq, sql } from "drizzle-orm";
import { site } from "@/content/site";
import { db } from "@/db";
import { invoiceCounters, invoices, type Invoice } from "@/db/schema";
import { financialYear, formatInvoiceNumber, splitGst } from "@/lib/gst";

export type Billing = { gstin?: string; company?: string; address?: string };

export const supplierGstin = () => process.env.COMPANY_GSTIN?.trim().toUpperCase() || undefined;

export const invoiceUrl = (invoice: Pick<Invoice, "id">) => `${site.url}/invoice/${invoice.id}`;

const byOrder = async (orderId: string) =>
  (await db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(1))[0];

/**
 * The GST invoice for a paid order, issued on first call. Verify and the webhook may both
 * get here, so it is idempotent per order: the number is taken in the same transaction as
 * the insert, and a lost race rolls back, leaving no gap in the numbering.
 * Returns null (and logs) when COMPANY_GSTIN is not set or the database fails; the sale
 * still stands, and an invoice can be issued later by calling this again.
 */
export async function issueInvoice(input: {
  orderId: string;
  paymentId: string;
  description: string;
  totalPaise: number;
  buyer: { name: string; email: string; phone?: string } & Billing;
}): Promise<Invoice | null> {
  const gstin = supplierGstin();
  if (!gstin) {
    console.error("[invoice] COMPANY_GSTIN is not set; no invoice for order", input.orderId);
    return null;
  }
  try {
    const existing = await byOrder(input.orderId);
    if (existing) return existing;

    const buyerGstin = input.buyer.gstin || null;
    const tax = splitGst(input.totalPaise, buyerGstin);
    const issuedAt = new Date();
    const fy = financialYear(issuedAt);
    return await db.transaction(async (tx) => {
      const [{ n }] = await tx
        .insert(invoiceCounters)
        .values({ fy, last: 1 })
        .onConflictDoUpdate({ target: invoiceCounters.fy, set: { last: sql`${invoiceCounters.last} + 1` } })
        .returning({ n: invoiceCounters.last });
      const [row] = await tx
        .insert(invoices)
        .values({
          number: formatInvoiceNumber(fy, n),
          orderId: input.orderId,
          paymentId: input.paymentId,
          description: input.description,
          buyerName: input.buyer.name,
          buyerEmail: input.buyer.email,
          buyerPhone: input.buyer.phone || null,
          buyerGstin,
          buyerCompany: buyerGstin ? input.buyer.company || null : null,
          buyerAddress: buyerGstin ? input.buyer.address || null : null,
          supplierGstin: gstin,
          totalPaise: input.totalPaise,
          issuedAt,
          ...tax,
        })
        .returning();
      return row;
    });
  } catch (error) {
    // Most likely a concurrent call for the same order won; its invoice is the one.
    const winner = await byOrder(input.orderId).catch(() => undefined);
    if (winner) return winner;
    console.error("[invoice] could not issue invoice for order", input.orderId, error);
    return null;
  }
}

export const getInvoice = async (id: string) =>
  /^[0-9a-f-]{36}$/i.test(id) ? (await db.select().from(invoices).where(eq(invoices.id, id)).limit(1))[0] : undefined;
