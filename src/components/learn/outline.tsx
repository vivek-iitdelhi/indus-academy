import Link from "next/link";
import type { ChapterItems, LessonItem } from "@/app/learn/data";
import { CheckIcon } from "@/components/ui";
import { formatDuration } from "./playback";

export const formatLabel = { interactive: "Interactive course", standard: "Recorded course", live: "Live course" } as const;

export function ProgressBar({ percent, className = "" }: { percent: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Course progress"
      className={`h-1.5 overflow-hidden rounded-full bg-ink/10 ${className}`}
    >
      <div className="h-full rounded-full bg-pine transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function KindIcon({ kind, className = "size-4" }: { kind: LessonItem["kind"]; className?: string }) {
  return kind === "video" ? (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M5 3.5v9l7.5-4.5L5 3.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 8l1.8 1.8L10.5 6.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <rect x="3" y="7" width="10" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Chapters and lessons with kind, duration, done tick and locked state. */
export function CourseOutlineList({
  chapters,
  courseSlug,
  currentLessonId,
}: {
  chapters: ChapterItems[];
  courseSlug: string;
  currentLessonId?: string;
}) {
  const numbers = new Map(chapters.flatMap((c) => c.lessons).map((l, i) => [l.id, i + 1]));
  return (
    <ol className="space-y-6">
      {chapters.map((chapter) => (
        <li key={chapter.id}>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">{chapter.title}</p>
          <ol className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {chapter.lessons.length === 0 && <li className="px-4 py-3 text-[0.95rem] text-muted">Coming soon</li>}
            {chapter.lessons.map((lesson) => {
              const current = lesson.id === currentLessonId;
              const body = (
                <>
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full ${
                      lesson.done ? "bg-mint text-pine" : "bg-paper-2 text-muted"
                    }`}
                  >
                    {lesson.done ? (
                      <CheckIcon className="size-3.5" />
                    ) : lesson.unlocked ? (
                      <KindIcon kind={lesson.kind} className="size-3.5" />
                    ) : (
                      <LockIcon className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[0.95rem] leading-snug ${current ? "font-semibold text-ink" : ""}`}>
                      <span className="text-muted">{numbers.get(lesson.id)}. </span>
                      {lesson.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                      <span>{lesson.kind === "video" ? "Video" : "Quiz"}</span>
                      {lesson.durationSeconds > 0 && <span>· {formatDuration(lesson.durationSeconds)}</span>}
                      {lesson.isPreview && <span className="text-pine">· Free preview</span>}
                      {lesson.done && <span className="sr-only">· Completed</span>}
                      {!lesson.unlocked && <span className="sr-only">· Locked</span>}
                    </span>
                  </span>
                </>
              );
              const row = "flex items-center gap-3 px-4 py-3";
              return (
                <li key={lesson.id}>
                  {lesson.unlocked ? (
                    <Link
                      href={`/learn/${courseSlug}/${lesson.slug}`}
                      aria-current={current ? "page" : undefined}
                      className={`${row} transition-colors hover:bg-paper ${current ? "bg-mint/40" : ""}`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={`${row} text-ink/50`}>{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
