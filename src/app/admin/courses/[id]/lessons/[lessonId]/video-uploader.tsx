"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Upload, type DetailedError } from "tus-js-client";
import { buttonClass, secondaryButtonClass } from "../../../form-ui";

// stopped = cancelled or failed mid-upload; Retry resumes from the last uploaded chunk.
type Phase = "idle" | "uploading" | "stopped" | "processing" | "ready";
type Note = { text: string; error?: boolean } | null;

const CHUNK_SIZE = 50 * 1024 * 1024; // the provider wants a multiple of 256 KiB, at least 5 MiB
const POLL_MS = 5000;

/** Why the upload failed: our endpoint's JSON error when there is one, else tus's message. */
function reason(err: Error) {
  try {
    return (JSON.parse((err as DetailedError).originalResponse?.getBody() ?? "") as { error?: string }).error ?? err.message;
  } catch {
    return err.message;
  }
}

export function VideoUploader({
  lessonId,
  hasVideo,
  ready,
  published,
}: {
  lessonId: string;
  hasVideo: boolean;
  ready: boolean;
  published: boolean;
}) {
  const router = useRouter();
  const upload = useRef<Upload | null>(null);
  const [phase, setPhase] = useState<Phase>(hasVideo ? (ready ? "ready" : "processing") : "idle");
  const [percent, setPercent] = useState(0);
  const [note, setNote] = useState<Note>(null);

  // While processing, poll until the video is ready, then re-render the page (preview, duration).
  useEffect(() => {
    if (phase !== "processing") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/admin/lessons/${lessonId}/video`).catch(() => null);
      if (!res?.ok) return;
      const status = (await res.json()) as { state: string; ready: boolean };
      if (status.ready) {
        setPhase("ready");
        setNote(null);
        router.refresh();
      } else if (status.state === "error") {
        setPhase("idle");
        setNote({ text: "The video could not be processed. Upload it again, or another file.", error: true });
      } else {
        setNote({ text: `Processing (${status.state})… this can take a while for long videos.` });
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [phase, lessonId, router]);

  // Closing the tab mid-upload loses the upload; ask first.
  useEffect(() => {
    if (phase !== "uploading") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  function resume() {
    upload.current?.start();
    setPhase("uploading");
    setNote(null);
  }

  function start(file: File) {
    upload.current?.abort();
    setPercent(0);
    upload.current = new Upload(file, {
      endpoint: `/api/admin/uploads?lessonId=${lessonId}`,
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 3000, 10000, 30000, 60000],
      metadata: { filename: file.name, filetype: file.type },
      // Each chosen file is a new upload (and video) on the lesson; Retry on this page resumes it.
      storeFingerprintForResuming: false,
      // Retry chunk transfers on network/server errors, but not our creation POST (e.g. 503).
      onShouldRetry: (err: DetailedError) => {
        const status = err.originalResponse?.getStatus() ?? 0;
        const clientError = status >= 400 && status < 500 && status !== 409 && status !== 423;
        return err.originalRequest?.getMethod() !== "POST" && !clientError;
      },
      onProgress: (sent, total) => setPercent(Math.floor((sent / total) * 100)),
      onError: (err) => {
        setPhase("stopped");
        setNote({ text: reason(err), error: true });
      },
      onSuccess: () => {
        setPhase("processing");
        setNote({ text: "Upload complete. Processing…" });
        router.refresh();
      },
    });
    resume();
  }

  const busy = phase === "uploading" || phase === "stopped";

  return (
    <div className="space-y-4">
      {published && (
        <p className="text-xs text-muted">
          This course is live. While a replacement uploads and processes, learners can&apos;t play this lesson.
        </p>
      )}

      {busy && (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-label="Upload progress" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-pine transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-sm tabular-nums">
            {percent}% uploaded{phase === "stopped" && " · stopped"}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {phase === "uploading" ? (
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              upload.current?.abort();
              setPhase("stopped");
              setNote({ text: "Upload cancelled. Retry to continue where it stopped." });
            }}
          >
            Cancel upload
          </button>
        ) : (
          <>
            {phase === "stopped" && (
              <button type="button" className={buttonClass} onClick={resume}>
                Retry
              </button>
            )}
            <label className={`${phase === "stopped" ? secondaryButtonClass : buttonClass} cursor-pointer`}>
              {hasVideo || phase === "stopped" ? "Choose a different file" : "Upload video"}
              <input
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) start(file);
                }}
              />
            </label>
          </>
        )}
      </div>

      {note && (
        <p role={note.error ? "alert" : "status"} className={`text-sm ${note.error ? "text-red-800" : "text-muted"}`}>
          {note.text}
        </p>
      )}
    </div>
  );
}
