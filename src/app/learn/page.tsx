import Link from "next/link";
import { asc, inArray } from "drizzle-orm";
import { activeCourses, loadCourseState } from "@/app/learn/data";
import { formatLabel, ProgressBar } from "@/components/learn/outline";
import { percentComplete } from "@/components/learn/playback";
import { Accent, ButtonLink, Container } from "@/components/ui";
import { db } from "@/db";
import { liveSessions, type LiveSession } from "@/db/schema";
import { formatDateTime } from "@/lib/admin/ops";
import { liveStatus } from "@/lib/live";
import { requireUser } from "@/lib/session";

/** My courses: each course with the one thing to do next, live classes first. */
export default async function LearnPage() {
  const user = await requireUser("/learn");
  const courses = await activeCourses(user.id);
  const [cards, sessions] = await Promise.all([
    Promise.all(courses.map(async (course) => ({ course, state: await loadCourseState(user.id, course) }))),
    courses.length
      ? db.select().from(liveSessions).where(inArray(liveSessions.courseId, courses.map((c) => c.id))).orderBy(asc(liveSessions.startsAt))
      : Promise.resolve([] as LiveSession[]),
  ]);
  const now = new Date();
  const classesOf = (courseId: string) => sessions.filter((s) => s.courseId === courseId);
  const slugOf = new Map(courses.map((c) => [c.id, c.slug]));
  const titleOf = new Map(courses.map((c) => [c.id, c.title]));
  // Classes open now or still to come, soonest first.
  const coming = sessions.filter((s) => liveStatus(s, now) !== "ended");

  return (
    <Container className="py-8 sm:py-12">
      <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">My courses</h1>
      <p className="mt-1 text-muted">Hi{user.firstName || user.name ? `, ${user.firstName || user.name.split(" ")[0]}` : ""}. Pick up where you left off.</p>

      {!user.name.trim() && (
        <p className="mt-6 max-w-2xl rounded-2xl border border-saffron/50 bg-saffron/10 p-4 text-sm leading-relaxed">
          Add your name before you start: it is printed on your certificates.{" "}
          <Link href="/learn/account" className="font-medium text-pine underline underline-offset-4">
            Add your name
          </Link>
        </p>
      )}

      {coming.length > 0 && (
        <section aria-labelledby="live-heading" className="mt-8">
          <h2 id="live-heading" className="text-lg font-semibold tracking-[-0.01em]">
            Live classes
          </h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {coming.map((s) => {
              const open = liveStatus(s, now) === "open";
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">
                      {open && <span className="mr-2 inline-block size-2 rounded-full bg-red-600 align-middle" aria-hidden />}
                      {s.title}
                    </p>
                    <p className="text-sm text-muted">
                      {titleOf.get(s.courseId)} · {formatDateTime(s.startsAt)} · {s.durationMinutes} min
                    </p>
                  </div>
                  {open ? (
                    <ButtonLink href={`/learn/${slugOf.get(s.courseId)}/live/${s.id}`} variant="dark" className="h-10">
                      Join now
                    </ButtonLink>
                  ) : (
                    <p className="text-sm text-muted">Join opens 15 minutes before</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {cards.length === 0 ? (
        <div className="mt-8 max-w-xl rounded-3xl border border-line bg-white p-6 sm:p-8">
          <p className="text-xl font-semibold tracking-[-0.01em]">
            No courses <Accent>yet</Accent>.
          </p>
          <p className="mt-2 text-muted">When you buy or join a course, it appears here.</p>
          <ButtonLink href="/courses" variant="dark" className="mt-6 h-11">
            Browse courses
          </ButtonLink>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ course, state }) => {
            const href = `/learn/${course.slug}`;
            const classes = classesOf(course.id);
            const openClass = classes.find((s) => liveStatus(s, now) === "open");
            const nextClass = classes.find((s) => liveStatus(s, now) === "upcoming");
            const percent = percentComplete(state.done, state.total);
            const certificate = state.certificate && !state.certificate.revokedAt;
            return (
              <li key={course.id} className="flex flex-col rounded-2xl border border-line bg-white p-5">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-pine">{formatLabel[course.format]}</p>
                <h2 className="mt-2 text-lg font-semibold leading-snug tracking-[-0.01em]">
                  <Link href={href} className="hover:text-pine">
                    {course.title}
                  </Link>
                </h2>
                <div className="mt-auto pt-5">
                  {state.total > 0 && (
                    <>
                      <p className="flex justify-between text-sm text-muted">
                        <span>
                          {state.done} of {state.total} lessons
                        </span>
                        <span className="font-medium text-ink">{percent}%</span>
                      </p>
                      <ProgressBar percent={percent} className="mt-2" />
                    </>
                  )}
                  {!openClass && nextClass && <p className="text-sm text-muted">Next class: {formatDateTime(nextClass.startsAt)}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                    {openClass ? (
                      <ButtonLink href={`${href}/live/${openClass.id}`} variant="dark" className="h-11 w-full sm:w-auto">
                        Join live class
                      </ButtonLink>
                    ) : state.next ? (
                      <ButtonLink href={`${href}/${state.next.slug}`} variant="dark" className="h-11 w-full sm:w-auto">
                        {state.done ? "Continue" : "Start"}
                      </ButtonLink>
                    ) : (
                      <ButtonLink href={href} variant={state.total > 0 ? "outline" : "dark"} className="h-11 w-full sm:w-auto">
                        {state.total > 0 ? "Review course" : classes.some((s) => liveStatus(s, now) === "ended") ? "Recordings" : "Open course"}
                      </ButtonLink>
                    )}
                    {certificate && (
                      <Link href="/learn/certificates" className="text-sm font-medium text-pine underline underline-offset-4">
                        View certificate
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
