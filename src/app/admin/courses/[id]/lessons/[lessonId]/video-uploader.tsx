"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonClass, secondaryButtonClass } from "../../../form-ui";

// stopped = cancelled or failed mid-upload; Retry resumes from the parts already sent.
type Phase = "idle" | "uploading" | "stopped" | "processing" | "ready";
type Note = { text: string; error?: boolean } | null;
/** One upload: the file, and the server's presigned part URLs with the ETags collected so far. */
type Session = { file: File; uid: string; uploadId: string; partSize: number; partUrls: string[]; etags: (string | null)[] };

const POLL_MS = 5000;
const PARALLEL_PARTS = 3;
const RETRY_DELAYS_MS = [1000, 3000, 10_000, 30_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function errorOf(res: Response) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? `The server responded ${res.status}.`);
}

/** PUTs one part to storage, retrying network errors and 5xx; returns its ETag. */
async function putPart(url: string, blob: Blob, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    let failure: unknown;
    try {
      const res = await fetch(url, { method: "PUT", body: blob, signal });
      if (res.ok) {
        const etag = res.headers.get("etag");
        if (!etag) throw new Error("Storage did not return an ETag (check the bucket's CORS ExposeHeaders).");
        return etag;
      }
      if (res.status < 500) throw new Error(`Storage refused the upload (${res.status}). Choose the file again.`);
      failure = new Error(`Storage responded ${res.status}.`);
    } catch (e) {
      if (!(e instanceof TypeError) || signal.aborted) throw e; // TypeError: the network failed
      failure = e;
    }
    if (attempt >= RETRY_DELAYS_MS.length) throw failure;
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

export function VideoUploader({
  lessonId,
  hasVideo,
  pending,
  ready,
}: {
  lessonId: string;
  /** A live video is attached. */
  hasVideo: boolean;
  /** A replacement is uploading or processing. */
  pending: boolean;
  /** The live video is ready. */
  ready: boolean;
}) {
  const router = useRouter();
  // Kept after a stop so Retry can resume it; send() fills its etags in place.
  const [session, setSession] = useState<Session | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<Phase>(
    pending || (hasVideo && !ready) ? "processing" : hasVideo ? "ready" : "idle",
  );
  const [percent, setPercent] = useState(0);
  const [note, setNote] = useState<Note>(null);

  // While processing, poll until the video is ready, then re-render the page (preview, duration).
  useEffect(() => {
    if (phase !== "processing") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/admin/lessons/${lessonId}/video`).catch(() => null);
      if (res?.status === 404) {
        // The replacement was discarded and there is no live video: nothing to wait for.
        setPhase("idle");
        setNote(null);
        return;
      }
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
        setNote({ text: "Processing… this can take a while for long videos." });
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

  async function send(current: Session) {
    const controller = new AbortController();
    abort.current = controller;
    setPhase("uploading");
    setNote(null);
    const { file, partSize, partUrls, etags } = current;
    const sentBytes = () => etags.reduce((n, etag, i) => n + (etag ? Math.min(partSize, file.size - i * partSize) : 0), 0);
    setPercent(Math.floor((sentBytes() / file.size) * 100));
    try {
      let next = 0;
      const worker = async () => {
        for (let i = next++; i < partUrls.length; i = next++) {
          if (etags[i]) continue;
          etags[i] = await putPart(partUrls[i], file.slice(i * partSize, (i + 1) * partSize), controller.signal);
          setPercent(Math.floor((sentBytes() / file.size) * 100));
        }
      };
      await Promise.all(Array.from({ length: PARALLEL_PARTS }, worker));
      const res = await fetch("/api/admin/uploads", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, uid: current.uid, uploadId: current.uploadId, etags }),
      });
      if (!res.ok) throw await errorOf(res);
      setSession(null);
      setPhase("processing");
      setNote({ text: "Upload complete. Processing…" });
      router.refresh();
    } catch (e) {
      controller.abort(); // stop the other parts
      setPhase("stopped");
      if (abort.current === controller) {
        const text = e instanceof TypeError ? "The connection dropped. Retry to continue where it stopped." : e instanceof Error ? e.message : String(e);
        setNote({ text, error: true });
      }
    }
  }

  async function start(file: File) {
    abort.current?.abort();
    abort.current = null;
    setPercent(0);
    setPhase("uploading");
    setNote(null);
    const res = await fetch("/api/admin/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lessonId, size: file.size }),
    }).catch(() => null);
    if (!res?.ok) {
      setPhase("idle");
      setNote({ text: res ? (await errorOf(res)).message : "Could not reach the server.", error: true });
      return;
    }
    const ticket = (await res.json()) as Omit<Session, "file" | "etags">;
    const current = { ...ticket, file, etags: ticket.partUrls.map(() => null) };
    setSession(current);
    router.refresh(); // shows the pending replacement
    void send(current);
  }

  const busy = phase === "uploading" || phase === "stopped";

  return (
    <div className="space-y-4">
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
              const controller = abort.current;
              abort.current = null;
              controller?.abort();
              setPhase("stopped");
              setNote({ text: "Upload cancelled. Retry to continue where it stopped." });
            }}
          >
            Cancel upload
          </button>
        ) : (
          <>
            {phase === "stopped" && session && (
              <button type="button" className={buttonClass} onClick={() => void send(session)}>
                Retry
              </button>
            )}
            <label className={`${phase === "stopped" ? secondaryButtonClass : buttonClass} cursor-pointer`}>
              {phase === "stopped" ? "Choose a different file" : hasVideo || pending ? "Replace video" : "Upload video"}
              <input
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void start(file);
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
