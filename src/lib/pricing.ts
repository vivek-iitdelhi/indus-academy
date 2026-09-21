import type { Program } from "@/content/programs";

export type ActivePrice = {
  amount: number;
  isEarlyBird: boolean;
  /** The full price, shown struck through while early-bird pricing is live. */
  listPrice: number;
  until?: string;
  seats?: number;
};

/** Today's date in India, which is how cohort and deadline dates are written. */
export const todayInIndia = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * The price a seat is actually sold at right now. Always recomputed on the
 * server before taking payment, never trusted from the browser.
 */
export function activePrice(program: Program): ActivePrice | null {
  const seat = program.price.seat;
  if (!seat) return null;

  const earlyBird = program.cohort?.earlyBird;
  if (earlyBird && todayInIndia() <= earlyBird.until) {
    return {
      amount: earlyBird.price,
      isEarlyBird: true,
      listPrice: seat,
      until: earlyBird.until,
      seats: earlyBird.seats,
    };
  }

  return { amount: seat, isEarlyBird: false, listPrice: seat };
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export const cohortIsOpen = (program: Program) =>
  Boolean(program.cohort && todayInIndia() <= program.cohort.startDate);
