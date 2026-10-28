"use client";

import { useRef } from "react";

/**
 * The webinar.gg room in an iframe, with our own Full screen button. Ours works from the page
 * itself, so it does not depend on webinar.gg's in-room button working inside an iframe.
 */
export function LiveRoom({ src, title, allow, className }: { src: string; title: string; allow: string; className: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  function fullScreen() {
    const el = frame.current as (HTMLIFrameElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.(); // Safari before 16.4
  }
  return (
    <div className="mt-6">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={fullScreen}
          className="rounded-full border border-ink/15 px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-ink/[0.03]"
        >
          Full screen
        </button>
      </div>
      <iframe ref={frame} src={src} title={title} allow={allow} allowFullScreen className={className} />
    </div>
  );
}
