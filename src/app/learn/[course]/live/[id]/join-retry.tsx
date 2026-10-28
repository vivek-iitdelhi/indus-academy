"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { backoffMs } from "@/lib/backoff";

/**
 * Shown while too many learners are joining at once: re-renders the page (which tries for a
 * room link again) after a backoff with jitter, so a crowd of retries spreads out.
 */
export function JoinRetry({ className, children }: { className: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const attempt = useRef(0);
  useEffect(() => {
    if (pending) return;
    const timer = setTimeout(() => startTransition(() => router.refresh()), backoffMs(attempt.current++, { base: 2_000, cap: 30_000 }));
    return () => clearTimeout(timer);
  }, [pending, router]);
  return (
    <p role="status" className={className}>
      {children}
    </p>
  );
}
