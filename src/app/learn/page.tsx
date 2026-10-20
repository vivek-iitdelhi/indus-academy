import Link from "next/link";
import { activeCourses, loadCourseState } from "@/app/learn/data";
import { formatLabel, ProgressBar } from "@/components/learn/outline";
import { percentComplete } from "@/components/learn/playback";
import { Accent, ButtonLink, Container, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/session";

export default async function LearnPage() {
  const user = await requireUser("/learn");
  const courses = await activeCourses(user.id);
  const cards = await Promise.all(
    courses.map(async (course) => ({ course, state: await loadCourseState(user.id, course) })),
  );

  return (
    <Container className="py-10 sm:py-16">
      <Eyebrow>My learning</Eyebrow>
      <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
        Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
      </h1>

      {!user.name.trim() && (
        <p className="mt-6 max-w-2xl rounded-2xl border border-saffron/50 bg-saffron/10 p-4 text-sm leading-relaxed">
          Add your name before you start: it is printed on your certificates.{" "}
          <Link href="/learn/account" className="font-medium text-pine underline underline-offset-4">
            Add your name
          </Link>
        </p>
      )}

      {cards.length === 0 ? (
        <div className="mt-10 max-w-xl rounded-3xl border border-line bg-white p-6 sm:p-8">
          <p className="text-xl font-semibold tracking-[-0.01em]">
            No courses <Accent>yet</Accent>.
          </p>
          <p className="mt-2 text-muted">When you buy or join a course, it appears here with your progress.</p>
          <ButtonLink href="/courses" variant="dark" className="mt-6 h-11">
            Browse courses
          </ButtonLink>
        </div>
      ) : (
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {cards.map(({ course, state }) => {
            const percent = percentComplete(state.done, state.total);
            const certificate = state.certificate && !state.certificate.revokedAt;
            return (
              <li key={course.id} className="flex flex-col rounded-3xl border border-line bg-white p-5 sm:p-6">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-pine">
                  {formatLabel[course.format]}
                </p>
                <h2 className="mt-2 text-xl font-semibold leading-snug tracking-[-0.01em]">
                  <Link href={`/learn/${course.slug}`} className="hover:text-pine">
                    {course.title}
                  </Link>
                </h2>
                <div className="mt-auto pt-6">
                  <p className="flex justify-between text-sm text-muted">
                    <span>
                      {state.done} of {state.total} lessons
                    </span>
                    <span className="font-medium text-ink">{percent}%</span>
                  </p>
                  <ProgressBar percent={percent} className="mt-2" />
                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                    {state.next ? (
                      <ButtonLink href={`/learn/${course.slug}/${state.next.slug}`} variant="dark" className="h-11">
                        {state.done ? "Continue" : "Start"}
                      </ButtonLink>
                    ) : (
                      <ButtonLink href={`/learn/${course.slug}`} variant="outline" className="h-11">
                        Review course
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
