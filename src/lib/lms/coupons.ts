import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { coupons } from "../../db/schema.ts";

/** What learners type, as stored: trimmed and uppercase. Null if it can't be a code. */
export function normalizeCode(input: unknown): string | null {
  const code = String(input ?? "").trim().toUpperCase();
  return /^[A-Z0-9_-]{3,32}$/.test(code) ? code : null;
}

/** Cashfree's smallest order is ₹1; anything less is treated as free. */
export const MIN_ORDER_PAISE = 100;

/** The price after `percentOff`, rounded to the paisa; 0 when below the smallest order. Pure. */
export function discountedPaise(pricePaise: number, percentOff: number): number {
  const paise = Math.round((pricePaise * (100 - percentOff)) / 100);
  return paise < MIN_ORDER_PAISE ? 0 : paise;
}

/** The active coupon with this code on this course, or null. */
export async function findCoupon(courseId: string, input: unknown) {
  const code = normalizeCode(input);
  if (!code) return null;
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.courseId, courseId), eq(coupons.code, code), eq(coupons.active, true)));
  return coupon ?? null;
}

export const INVALID_COUPON = "That coupon code isn't valid for this course.";
