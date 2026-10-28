"use client";

import Link from "next/link";
import { useRef, useSyncExternalStore } from "react";
import { blocksEmbeddedRoom } from "@/lib/embedded-room";

const BUTTON =
  "rounded-full border border-ink/15 px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-ink/[0.03]";

const noSubscribe = () => () => {};
/** Null on the server and while hydrating; then whether this browser needs the room in its own tab. */
const useBlocksEmbeddedRoom = () =>
  useSyncExternalStore(noSubscribe, () => blocksEmbeddedRoom(navigator.userAgent, navigator.maxTouchPoints), () => null);

/**
 * The webinar.gg room, with our own controls. Inside an iframe webinar.gg's Leave does nothing and
 * its full-screen button may not work, so we add ours; browsers that block embedded cookies get the
 * room in their own tab instead, where everything works.
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
  const ownTab = useBlocksEmbeddedRoom();
  function fullScreen() {
    const el = frame.current as (HTMLIFrameElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.(); // Safari before 16.4
  }

  if (ownTab === null) return <p className="mt-6 text-sm text-muted">Opening the class…</p>;
  if (ownTab) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <p className="font-medium">This browser opens the class on its own page.</p>
        <p className="mt-1 text-sm text-muted">
          Safari, and browsers on iPhone and iPad, can&apos;t run the class inside this page. Join it below; when you&apos;re done,
          come back here with your browser&apos;s back button.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={src} className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-pine">
            Join the class
          </a>
          {leaveHref && (
            <Link href={leaveHref} className={`${BUTTON} self-center`}>
              Back to the course
            </Link>
          )}
        </div>
      </div>
    );
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
