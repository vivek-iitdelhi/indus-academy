"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/copy-button";
import { blocksEmbeddedRoom, isAppleMobile } from "@/lib/embedded-room";

const ROOM_ORIGIN = "https://webinar.gg";
// What the room posts to its parent page (webinar.gg docs, "Embedding the room"): the viewer is
// done with the room, so we take them back to the course.
const DONE = new Set(["webinar-user-left", "webinar-user-kicked", "webinar-tab-duplicate", "webinar-ended"]);

const ENDED_POLL_MS = 20_000;

const noSubscribe = () => () => {};
/**
 * Null on the server and while hydrating; then whether this browser blocks the room's cookies:
 * "phone" on iPhone/iPad (other than in Chrome), "browser" for Safari on a computer, else false.
 */
const useBlockedRoom = () =>
  useSyncExternalStore(
    noSubscribe,
    () => {
      const { userAgent, maxTouchPoints } = navigator;
      if (!blocksEmbeddedRoom(userAgent, maxTouchPoints)) return false;
      return isAppleMobile(userAgent, maxTouchPoints) ? "phone" : "browser";
    },
    () => null,
  );

/**
 * The webinar.gg room, filling the whole window, with nothing of ours around it: the room's own
 * Leave is the one Leave. Inside an iframe that button only calls window.close() (which does
 * nothing), but the room first posts "webinar-user-left", and that is what sends the viewer back
 * to `leaveHref`. The first click into the room also turns on true full screen.
 *
 * Safari and the other iPhone/iPad browsers block an embedded site's cookies, so the room can't
 * run there; webinar.gg's answer is "use Chrome", and nobody should land on webinar.gg itself. On
 * iPhone/iPad one tap reopens this page in Chrome (its googlechromes:// scheme); on a Mac,
 * where a web page can't launch Chrome, they copy the link.
 */
export function LiveRoom({
  src,
  title,
  allow,
  leaveHref,
  sessionId,
}: {
  src: string;
  title: string;
  allow: string;
  leaveHref: string;
  sessionId: string;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const blocked = useBlockedRoom();

  useEffect(() => {
    const goFull = () => {
      if (!document.fullscreenElement) box.current?.requestFullscreen?.().catch(() => {});
    };
    const leave = () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      router.replace(leaveHref);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin === ROOM_ORIGIN && DONE.has(e.data?.type)) leave();
    };
    // When the host ends the class, webinar.gg's room only shows "Webinar has ended" (it posts
    // nothing), so ask our server, which hears it from webinar.gg's webhook.
    const poll = setInterval(() => {
      fetch(`/api/live/${sessionId}/status`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((s: { ended?: boolean } | null) => s?.ended && leave())
        .catch(() => {});
    }, ENDED_POLL_MS);
    // A click inside the room moves focus into the iframe: the window blurs, with the click's user
    // activation, which is what the browser needs to allow full screen.
    const onBlur = () => {
      if (document.activeElement?.tagName === "IFRAME") goFull();
    };
    const onFullScreen = () => setFullScreen(Boolean(document.fullscreenElement));
    window.addEventListener("message", onMessage);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullScreen);
    return () => {
      clearInterval(poll);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullScreen);
    };
  }, [router, leaveHref, sessionId]);

  if (blocked === null) return <p className="fixed inset-0 z-50 grid place-items-center bg-black text-sm text-white/70">Opening the class…</p>;
  if (blocked === "phone") {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-line bg-white p-6 sm:p-8">
        <p className="text-xl font-semibold tracking-[-0.01em]">Open this class in Chrome</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">This browser can&apos;t run the live class. Chrome can: tap below and this page opens in Chrome.</p>
        <a
          href={`googlechromes://${location.host}${location.pathname}${location.search}`}
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-pine"
        >
          Open in Chrome
        </a>
        <p className="mt-4 text-sm text-muted">
          No Chrome?{" "}
          <a href="https://apps.apple.com/app/google-chrome/id535886823" className="font-medium text-pine underline underline-offset-4">
            Get it from the App Store
          </a>
          , then tap Open in Chrome again.
        </p>
      </div>
    );
  }
  if (blocked) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-line bg-white p-6 sm:p-8">
        <p className="text-xl font-semibold tracking-[-0.01em]">Open this class in Google Chrome</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This browser blocks what the live class needs. Copy this link, open it in Chrome, and you&apos;ll go straight into the class.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <CopyButton
            text={location.href}
            label="Copy class link"
            className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-pine"
          />
          <a href="https://www.google.com/chrome/" target="_blank" rel="noreferrer" className="text-sm font-medium text-pine underline underline-offset-4">
            Get Chrome
          </a>
        </div>
      </div>
    );
  }
  return (
    <div ref={box} className="fixed inset-0 z-50 bg-black">
      <iframe src={src} title={title} allow={allow} allowFullScreen className="h-full w-full border-0" />
      {!fullScreen && (
        <button
          type="button"
          onClick={() => box.current?.requestFullscreen?.().catch(() => {})}
          className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur hover:bg-black/80"
        >
          Full screen
        </button>
      )}
    </div>
  );
}
