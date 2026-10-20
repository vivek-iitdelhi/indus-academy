import Link from "next/link";
import { courseFormats } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { createCourse } from "../actions";
import { ActionForm, NewCourseFields } from "../client";
import { cardClass, formatLabels } from "../form-ui";

export default async function NewCoursePage() {
  await requireAdmin();
  return (
    <div className="max-w-2xl">
      <Link href="/admin/courses" className="text-sm text-muted hover:text-ink">
        ← Courses
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">New course</h1>
      <p className="mt-2 text-muted">It starts as a draft. You can change everything later.</p>

      <div className={`mt-8 ${cardClass}`}>
        <ActionForm action={createCourse} submitLabel="Create draft">
          <NewCourseFields />
          <fieldset>
            <legend className="text-sm font-medium">Format</legend>
            <div className="mt-2 space-y-2">
              {courseFormats.map((format, i) => (
                <label key={format} className="flex gap-3 rounded-xl border border-line p-3 has-checked:border-pine has-checked:bg-mint/30">
                  <input type="radio" name="format" value={format} defaultChecked={i === 0} className="mt-1 accent-pine" />
                  <span>
                    <span className="text-sm font-medium capitalize">{format}</span>
                    <span className="block text-sm text-muted">{formatLabels[format]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </div>
    </div>
  );
}
