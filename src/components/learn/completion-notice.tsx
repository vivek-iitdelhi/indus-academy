import Link from "next/link";
import { ArrowIcon, ButtonLink, CheckIcon } from "@/components/ui";

/** Shown when a lesson completes in this visit: next-lesson CTA, and the certificate if one was issued. */
export function CompletionNotice({ certificate, nextHref }: { certificate: boolean; nextHref: string | null }) {
  if (certificate) {
    return (
      <div role="status" className="rounded-3xl bg-ink p-6 text-paper sm:p-8">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-mint">Course complete</p>
        <p className="mt-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          You did it. Your certificate is <span className="font-serif font-normal italic">ready</span>.
        </p>
        <Link
          href="/learn/certificates"
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-saffron px-6 font-medium text-ink transition-colors hover:bg-saffron-2"
        >
          View certificate <ArrowIcon className="size-4" />
        </Link>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex flex-col gap-4 rounded-2xl border border-mint bg-mint/30 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-center gap-2.5 font-medium text-pine">
        <span className="grid size-6 place-items-center rounded-full bg-pine text-paper">
          <CheckIcon className="size-3.5" />
        </span>
        Lesson complete
      </p>
      {nextHref && (
        <ButtonLink href={nextHref} variant="dark" className="h-11">
          Next lesson
        </ButtonLink>
      )}
    </div>
  );
}
