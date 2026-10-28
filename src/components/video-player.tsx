"use client";

import type Hls from "hls.js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CompletionNotice } from "@/components/learn/completion-notice";
import { playedBetween, resumePosition, takeReportDelta } from "@/components/learn/playback";

const REPORT_EVERY_MS = 15_000;
const SAVE_LOCAL_EVERY_MS = 5_000;
const MAX_NETWORK_RETRIES = 4;
const positionKey = (lessonId: string) => `iaa:lesson-position:${lessonId}`;

function readLocalPosition(lessonId: string): number | null {
  try {
    const value = localStorage.getItem(positionKey(lessonId));
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}

function writeLocalPosition(lessonId: string, seconds: number) {
  try {
    localStorage.setItem(positionKey(lessonId), String(Math.floor(seconds)));
  } catch {
    // Storage full or blocked: resume falls back to the server's furthest point.
  }
}

type Props = {
  /** HLS manifest URL, already authorised for this viewer. */
  src: string;
  /** keyProof(token) for src's token: unlocks the segments' decryption key (see video.ts). */
  keyProof?: string;
  lessonId: string;
  title: string;
  durationSeconds: number;
  furthestSeconds: number;
  completed: boolean;
  /** False for preview viewers without an enrolment: nothing is reported. */
  track: boolean;
  nextHref: string | null;
  /** Where progress goes: lessons by default; a live class's recording has its own. */
  progressUrl?: string;
};

export function VideoPlayer(props: Props) {
  // Completion refreshes the page, which re-mints the URL and updates the progress props.
  // Keep what playback started with so a refresh never restarts the video.
  const [initial] = useState(props);
  const { lessonId, track, progressUrl = "/api/learn/progress" } = initial;
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastPosition = useRef<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [completion, setCompletion] = useState<{ certificate: boolean } | null>(null);
  const router = useRouter();

  // Playback: hls.js wherever it runs (MediaSource, or ManagedMediaSource on iOS 17.1+), since
  // only hls.js can send the key proof header; native HLS only as a last resort, which cannot
  // fetch the key of an encrypted video and so fails cleanly.
  useEffect(() => {
    const video = videoRef.current!;
    const startAt =
      lastPosition.current ??
      resumePosition({
        local: readLocalPosition(initial.lessonId),
        furthestSeconds: initial.furthestSeconds,
        completed: initial.completed,
        durationSeconds: initial.durationSeconds,
      });
    let hls: Hls | undefined;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let detachNative = () => {};

    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        if (!video.canPlayType("application/vnd.apple.mpegurl")) return setFailed(true);
        const seek = () => {
          if (startAt > 0) video.currentTime = startAt;
        };
        const fail = () => setFailed(true);
        video.addEventListener("loadedmetadata", seek, { once: true });
        video.addEventListener("error", fail);
        video.src = initial.src;
        detachNative = () => {
          video.removeEventListener("loadedmetadata", seek);
          video.removeEventListener("error", fail);
          video.removeAttribute("src");
          video.load();
        };
        return;
      }
      let networkRetries = 0;
      let mediaRecoveries = 0;
      // ManagedMediaSource (iOS) plays only with remote playback off; protected video has no AirPlay.
      video.disableRemotePlayback = true;
      const proof = initial.keyProof;
      const player = new Hls({
        startPosition: startAt,
        capLevelToPlayerSize: true,
        // Same header name as KEY_PROOF_HEADER in video.ts (a server module, not importable here).
        xhrSetup: (xhr, url) => {
          if (proof && /\/api\/video\/[^/]+\/key\?/.test(url)) xhr.setRequestHeader("x-iaa-key-proof", proof);
        },
      });
      hls = player;
      player.on(Hls.Events.FRAG_LOADED, () => {
        networkRetries = 0;
      });
      player.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return; // hls.js retries non-fatal errors itself
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < MAX_NETWORK_RETRIES) {
          networkRetries += 1;
          retryTimer = setTimeout(() => player.startLoad(), 1000 * 2 ** networkRetries);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
          mediaRecoveries += 1;
          player.recoverMediaError();
        } else {
          setFailed(true);
        }
      });
      player.loadSource(initial.src);
      player.attachMedia(video);
    });

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      hls?.destroy();
      detachNative();
    };
  }, [initial, attempt]);

  // Progress: count only media time actually played; report every 15 s while playing,
  // on pause/end, when the page is hidden, and when leaving the lesson.
  useEffect(() => {
    const video = videoRef.current!;
    let last = video.currentTime;
    let pending = 0;
    let lastReport = Date.now();
    let lastSave = 0;

    const save = () => {
      lastPosition.current = video.currentTime;
      writeLocalPosition(lessonId, video.currentTime);
      lastSave = Date.now();
    };

    const report = (beacon = false) => {
      if (!track) return;
      const { send, keep } = takeReportDelta(pending);
      pending = keep;
      lastReport = Date.now();
      const body = JSON.stringify({ lessonId, position: video.currentTime, watchedDelta: send });
      if (beacon && navigator.sendBeacon(progressUrl, new Blob([body], { type: "application/json" }))) {
        return;
      }
      fetch(progressUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).then(
        async (res) => {
          if (!res.ok) return;
          const data: { newlyCompleted: boolean; certificate: unknown } = await res.json();
          if (data.newlyCompleted) {
            setCompletion({ certificate: Boolean(data.certificate) });
            router.refresh(); // ticks, unlocks and progress in the outline
          }
        },
        () => {
          pending += send; // offline: keep the watched time for the next report
        },
      );
    };

    const onTimeUpdate = () => {
      const now = video.currentTime;
      if (!video.seeking) pending += playedBetween(last, now);
      last = now;
      if (Date.now() - lastSave >= SAVE_LOCAL_EVERY_MS) save();
      if (!video.paused && Date.now() - lastReport >= REPORT_EVERY_MS) report();
    };
    const onSeeking = () => {
      last = video.currentTime;
    };
    const onStop = () => {
      save();
      report();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      save();
      if (pending > 0) report(true);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("pause", onStop);
    video.addEventListener("ended", onStop);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("pause", onStop);
      video.removeEventListener("ended", onStop);
      document.removeEventListener("visibilitychange", onVisibility);
      // Client-side navigation away fires no visibilitychange.
      if (video.currentTime > 0) save();
      if (pending > 0) report(true);
    };
  }, [lessonId, track, progressUrl, router]);

  return (
    <div className="space-y-4">
      <div className="relative aspect-video overflow-hidden bg-ink sm:rounded-2xl">
        <video
          ref={videoRef}
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          onContextMenu={(event) => event.preventDefault()}
          playsInline
          preload="metadata"
          aria-label={initial.title}
          className="size-full"
        />
        {failed && (
          <div role="alert" className="absolute inset-0 grid place-items-center bg-ink/90 p-6 text-center text-paper">
            <div>
              <p className="font-medium">The video stopped loading.</p>
              <p className="mt-1 text-sm text-paper/70">Check your connection. Your progress is saved.</p>
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  setAttempt((n) => n + 1);
                }}
                className="mt-4 h-11 rounded-full bg-saffron px-6 text-sm font-medium text-ink transition-colors hover:bg-saffron-2"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
      {completion && (
        // The player runs edge to edge on phones; the notice keeps the page margin.
        <div className="px-5 sm:px-0">
          <CompletionNotice certificate={completion.certificate} nextHref={props.nextHref} />
        </div>
      )}
    </div>
  );
}
