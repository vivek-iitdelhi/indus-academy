import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, liveSessions } from "@/db/schema";
import { formatDateTime } from "@/lib/admin/ops";
import { liveConfigured, liveStatus } from "@/lib/live";
import { requireAdmin } from "@/lib/session";
import { deleteLiveSession, scheduleLiveClass } from "../courses/actions";
import { ActionForm, ConfirmButton } from "../courses/client";
import { cardClass, Field, inputClass, miniButtonClass, SectionTitle, secondaryButtonClass } from "../courses/form-ui";

/** Every live class: schedule one, host the next, find past recordings. */
export default async function LiveClassesPage() {
  await requireAdmin();
  const [rows, courseList] = await Promise.all([
    db
      .select({ session: liveSessions, course: { id: courses.id, title: courses.title } })
      .from(liveSessions)
      .innerJoin(courses, eq(liveSessions.courseId, courses.id))
      .orderBy(asc(liveSessions.startsAt)),
    db.select({ id: courses.id, title: courses.title, status: courses.status }).from(courses).orderBy(asc(courses.title)),
  ]);
  const upcoming = rows.filter((r) => liveStatus(r.session) !== "ended");
  const past = rows.filter((r) => liveStatus(r.session) === "ended").reverse();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Live classes</h1>
        <p className="mt-2 text-sm text-muted">
          Learners enrolled in the course join from their course page; partners&apos; learners through the API. Every class is
          recorded, and the recording appears here a few hours after it ends. Times are India time.
        </p>
      </div>

      <section className={cardClass}>
        <SectionTitle>Schedule a class</SectionTitle>
        {liveConfigured() ? (
          <ActionForm action={scheduleLiveClass} submitLabel="Schedule class" resetOnSuccess className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Course">
                <select name="courseId" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Choose a course
                  </option>
                  {courseList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                      {c.status === "published" ? "" : ` (${c.status})`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title">
                <input name="title" required placeholder="Week 1: Prompting basics" className={inputClass} />
              </Field>
              <Field label="Starts (India time)">
                <input name="startsAt" type="datetime-local" required className={inputClass} />
              </Field>
              <Field label="Length (minutes)">
                <input name="durationMinutes" type="number" min="15" max="480" step="5" required defaultValue={120} className={`${inputClass} tabular-nums`} />
              </Field>
            </div>
          </ActionForm>
        ) : (
          <p className="mt-3 rounded-xl bg-saffron/15 p-4 text-sm">Not set up: add WEBINAR_GG_TOKEN to the app&apos;s environment.</p>
        )}
      </section>

      <Sessions title="Upcoming" rows={upcoming} empty="No classes scheduled." host />
      {past.length > 0 && <Sessions title="Past" rows={past} empty="" />}
    </div>
  );
}

type Row = { session: typeof liveSessions.$inferSelect; course: { id: string; title: string } };

function Sessions({ title, rows, empty, host = false }: { title: string; rows: Row[]; empty: string; host?: boolean }) {
  return (
    <section className={cardClass}>
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted">
            <tr>
              <th className="py-2">Class</th>
              <th>Course</th>
              <th>Starts</th>
              <th className="text-right">Minutes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ session: s, course }) => (
              <tr key={s.id} className="border-t border-line">
                <td className="py-2 font-medium">{s.title}</td>
                <td>
                  <Link href={`/admin/courses/${course.id}`} className="hover:underline">
                    {course.title}
                  </Link>
                </td>
                <td>{formatDateTime(s.startsAt)}</td>
                <td className="text-right tabular-nums">{s.durationMinutes}</td>
                <td className="flex justify-end gap-2 py-2">
                  {host ? (
                    <Link href={`/admin/live/${s.id}`} className={liveStatus(s) === "open" ? secondaryButtonClass : miniButtonClass}>
                      Host
                    </Link>
                  ) : s.recordingUrl ? (
                    <a href={s.recordingUrl} target="_blank" rel="noreferrer" className={miniButtonClass}>
                      Recording
                    </a>
                  ) : (
                    <span className="self-center text-xs text-muted">Recording on its way</span>
                  )}
                  <form action={deleteLiveSession.bind(null, s.id)}>
                    <ConfirmButton
                      message={host ? `Cancel “${s.title}”? Learners can no longer join it.` : `Delete “${s.title}” and its recording link?`}
                      className={`${miniButtonClass} text-red-800`}
                    >
                      {host ? "Cancel" : "Delete"}
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
