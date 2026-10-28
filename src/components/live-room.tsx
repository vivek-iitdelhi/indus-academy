"use client";

import Link from "next/link";
import { useRef } from "react";

const BUTTON =
  "rounded-full border border-ink/15 px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-ink/[0.03]";

/**
 * The webinar.gg room in an iframe, with our own controls around it. Inside an iframe,
 * webinar.gg's Leave button does nothing and its full-screen button may not work, and browsers
 * that block third-party cookies (Safari, Brave, private windows, many phones) also break its
 * chat and reactions. So: our Full screen, our Leave, and the same room in its own tab as a fallback.
 */
export function LiveRoom({
  src,
  title,
  allow,
  className,
  leaveHref,
}: {
  src: string;
  title: string;
  allow: string;
  className: string;
  /** Where Leave goes (the course page). No Leave button without it. */
  leaveHref?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  function fullScreen() {
    const el = frame.current as (HTMLIFrameElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.(); // Safari before 16.4
  }
  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        <a href={src} target="_blank" rel="noreferrer" className="mr-auto text-sm text-muted underline underline-offset-4 hover:text-ink">
          Chat or reactions not working? Open the class in its own tab
        </a>
        <button type="button" onClick={fullScreen} className={BUTTON}>
          Full screen
        </button>
        {leaveHref && (
          <Link href={leaveHref} className={`${BUTTON} border-red-800/30 text-red-800 hover:border-red-800/60`}>
            Leave class
          </Link>
        )}
      </div>
      <iframe ref={frame} src={src} title={title} allow={allow} allowFullScreen className={className} />
    </div>
  );
}
