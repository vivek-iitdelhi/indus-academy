import Link from "next/link";
import { courseFormats } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { createCourse } from "../actions";
import { ActionForm, FormatChoice, NewCourseFields } from "../client";
import { cardClass, formatLabels, LiveClassFields } from "../form-ui";

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
          <FormatChoice formats={courseFormats} labels={formatLabels} liveFields={<LiveClassFields />} />
        </ActionForm>
      </div>
    </div>
  );
}
