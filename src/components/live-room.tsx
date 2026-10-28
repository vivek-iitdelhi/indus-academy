"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { blocksEmbeddedRoom } from "@/lib/embedded-room";

const ROOM_ORIGIN = "https://webinar.gg";
// What the room posts to its parent page (webinar.gg docs, "Embedding the room"): the viewer is
// done with the room, so we take them back to the course.
const DONE = new Set(["webinar-user-left", "webinar-user-kicked", "webinar-tab-duplicate", "webinar-ended"]);

const noSubscribe = () => () => {};
/** Null on the server and while hydrating; then whether this browser needs the room on its own page. */
const useBlocksEmbeddedRoom = () =>
  useSyncExternalStore(noSubscribe, () => blocksEmbeddedRoom(navigator.userAgent, navigator.maxTouchPoints), () => null);

/**
 * The webinar.gg room, filling the whole window, with nothing of ours around it: the room's own
 * Leave is the one Leave. Inside an iframe that button only calls window.close() (which does
 * nothing), but the room first posts "webinar-user-left", and that is what sends the viewer back
 * to `leaveHref`. The first click into the room also turns on true full screen.
 *
 * Safari and every iPhone/iPad browser block an embedded site's cookies, so there the room opens
 * on its own page instead (`ownPage`).
 */
export function LiveRoom({ src, title, allow, leaveHref }: { src: string; title: string; allow: string; leaveHref: string }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const ownPage = useBlocksEmbeddedRoom();

  useEffect(() => {
    const goFull = () => {
      if (!document.fullscreenElement) box.current?.requestFullscreen?.().catch(() => {});
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== ROOM_ORIGIN || !DONE.has(e.data?.type)) return;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      router.replace(leaveHref);
    };
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
      window.removeEventListener("message", onMessage);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullScreen);
    };
  }, [router, leaveHref]);

  if (ownPage === null) return <p className="fixed inset-0 z-50 grid place-items-center bg-black text-sm text-white/70">Opening the class…</p>;
  if (ownPage) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <p className="font-medium">This browser opens the class on its own page.</p>
        <p className="mt-1 text-sm text-muted">
          Safari, and browsers on iPhone and iPad, can&apos;t run the class inside this page. Join it below; when you&apos;re done,
          come back here with your browser&apos;s back button.
        </p>
        <a href={src} className="mt-4 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-pine">
          Join the class
        </a>
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
