"use client";

import { usePathname } from "next/navigation";

/**
 * The marketing header and footer, left out of the learner area (/learn), which has its own
 * app bar so learners get straight to their courses.
 */
export function MarketingChrome({ children }: { children: React.ReactNode }) {
  return usePathname().startsWith("/learn") ? null : children;
}
