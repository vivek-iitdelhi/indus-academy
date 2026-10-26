"use server";

import { and, asc, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import {
  chapters,
  courseFormats,
  coupons,
  courseStatuses,
  courses,
  lessonKinds,
  lessons,
  liveSessions,
  quizQuestions,
  type CourseStatus,
} from "@/db/schema";
import {
  coursePublishProblems,
  isUuid,
  learnerRecordCounts,
  move,
  parseQuestion,
  renumberOutline,
  uniqueSlug,
} from "@/lib/admin/courses";
import { revalidateCourse } from "@/lib/catalog-cache";
import { createWebinar, deleteWebinar, liveConfigured, parseIndiaDateTime } from "@/lib/live";
import { normalizeCode } from "@/lib/lms/coupons";
import { requireAdminApi } from "@/lib/session";
import { deleteVideo, videoConfigured } from "@/lib/video";
import { SLUG_PATTERN, slugify } from "./slug";

export type ActionResult = { error?: string; ok?: string };

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const checked = (form: FormData, name: string) => form.get(name) === "on";
const MAX_PRICE_PAISE = 2_000_000_000; // integer column headroom
// Bound arguments arrive from the client, so treat them as untrusted: up or down one place.
const step = (delta: unknown) => (Number(delta) < 0 ? -1 : 1);

const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
};

async function findCourse(courseId: string) {
  if (!isUuid(courseId)) notFound();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) notFound();
  return course;
}

async function findLesson(lessonId: string) {
  if (!isUuid(lessonId)) notFound();
  const [row] = await db
    .select({ lesson: lessons, course: courses })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(eq(lessons.id, lessonId));
  if (!row) notFound();
  return row;
}

async function findChapter(chapterId: string) {
  if (!isUuid(chapterId)) notFound();
  const [row] = await db
    .select({ chapter: chapters, course: courses })
    .from(chapters)
    .innerJoin(courses, eq(chapters.courseId, courses.id))
    .where(eq(chapters.id, chapterId));
  if (!row) notFound();
  return row;
}

/** Public catalogue + the admin page the action was called from. */
function changed(slug: string) {
  revalidateCourse(slug);
  refresh();
}

/** Best effort: a failed delete leaves an orphan in the video library, not a broken course. */
const videoColumns = { videoUid: lessons.videoUid, pendingVideoUid: lessons.pendingVideoUid };

async function deleteVideos(uids: (string | null)[]) {
  if (!videoConfigured()) return;
  for (const uid of uids) {
    if (uid) await deleteVideo(uid).catch((e) => console.error(`deleteVideo ${uid} failed`, e));
  }
}

// --- Courses ---------------------------------------------------------------

export async function createCourse(form: FormData): Promise<ActionResult> {
  await requireAdminApi();
  const title = text(form, "title");
  const slug = text(form, "slug");
  const format = text(form, "format");
  if (!title) return { error: "Give the course a title." };
  if (!SLUG_PATTERN.test(slug)) return { error: "Slug: lowercase letters, numbers and hyphens only." };
  if (!courseFormats.includes(format as never)) return { error: "Choose a format." };

  let id: string;
  try {
    [{ id }] = await db
      .insert(courses)
      .values({
        title,
        slug,
        format: format as (typeof courseFormats)[number],
        sequential: format === "interactive",
      })
      .returning({ id: courses.id });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `Another course already uses the slug “${slug}”.` };
    throw e;
  }
  redirect(`/admin/courses/${id}`);
}

export async function updateCourse(courseId: string, form: FormData): Promise<ActionResult> {
  await requireAdminApi();
  const course = await findCourse(courseId);
  const title = text(form, "title");
  const slug = text(form, "slug");
  const format = text(form, "format");
  const rupees = Number(text(form, "price") || "0");
  const coverImageUrl = text(form, "coverImageUrl");

  if (!title) return { error: "Give the course a title." };
  if (!SLUG_PATTERN.test(slug)) return { error: "Slug: lowercase letters, numbers and hyphens only." };
  if (!courseFormats.includes(format as never)) return { error: "Choose a format." };
  const pricePaise = Math.round(rupees * 100);
  if (!Number.isFinite(rupees) || pricePaise < 0 || pricePaise > MAX_PRICE_PAISE) {
    return { error: "Price must be a positive amount in rupees (0 for free)." };
  }
  if (pricePaise > 0 && pricePaise < 100) return { error: "The payment gateway's minimum is ₹1: use 0 for free, or at least 1." };
  const listRupees = text(form, "listPrice");
  const listPricePaise = listRupees ? Math.round(Number(listRupees) * 100) : null;
  if (listPricePaise !== null && !(listPricePaise > pricePaise && listPricePaise <= MAX_PRICE_PAISE)) {
    return { error: "The price before discount must be higher than the price, or left empty." };
  }
  if (coverImageUrl && !/^https?:\/\/\S+$/.test(coverImageUrl)) {
    return { error: "Cover image must be a full http(s) URL." };
  }

  try {
    await db
      .update(courses)
      .set({
        title,
        slug,
        format: format as (typeof courseFormats)[number],
        subtitle: text(form, "subtitle") || null,
        description: text(form, "description") || null,
        pricePaise,
        listPricePaise,
        sequential: checked(form, "sequential"),
        certificateEnabled: checked(form, "certificateEnabled"),
        coverImageUrl: coverImageUrl || null,
      })
      .where(eq(courses.id, course.id));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `Another course already uses the slug “${slug}”.` };
    throw e;
  }
  if (slug !== course.slug) revalidateCourse(course.slug);
  changed(slug);
  return { ok: "Saved." };
}

export async function setCourseStatus(courseId: string, status: CourseStatus): Promise<ActionResult> {
  await requireAdminApi();
  const course = await findCourse(courseId);
  if (!courseStatuses.includes(status)) notFound();
  if (status === "published") {
    const problems = await coursePublishProblems(course.id);
    if (problems.length) {
      refresh(); // the page lists the problems
      return { error: `Can't publish yet: ${problems.length} thing${problems.length === 1 ? "" : "s"} to fix, listed above.` };
    }
  }
  if (status === "draft") {
    const records = await learnerRecordCounts(course.id);
    // Drafts are hidden from everyone, including enrolled learners.
    if (records.enrollments) return { error: "Learners are enrolled, so it can't go back to draft. Archive it instead." };
  }
  await db.update(courses).set({ status }).where(eq(courses.id, course.id));
  changed(course.slug);
  return { ok: `Course is now ${status}.` };
}

export async function deleteCourse(courseId: string) {
  await requireAdminApi();
  const course = await findCourse(courseId);
  const records = await learnerRecordCounts(course.id);
  if (records.enrollments || records.payments || records.certificates) {
    throw new Error("This course has enrolments, payments or certificates; archive it instead.");
  }
  const videos = await db.select(videoColumns).from(lessons).where(eq(lessons.courseId, course.id));
  await db.delete(courses).where(eq(courses.id, course.id)); // chapters, lessons, questions cascade
  await deleteVideos(videos.flatMap((v) => [v.videoUid, v.pendingVideoUid]));
  revalidateCourse(course.slug);
  redirect("/admin/courses");
}

// --- Chapters --------------------------------------------------------------

export async function addChapter(courseId: string, form: FormData) {
  await requireAdminApi();
  const course = await findCourse(courseId);
  const title = text(form, "title") || "New chapter";
  await db.transaction(async (tx) => {
    await tx.insert(chapters).values({ courseId: course.id, title, position: 1_000_000 });
    await renumberOutline(tx, course.id);
  });
  changed(course.slug);
}

export async function renameChapter(chapterId: string, form: FormData): Promise<ActionResult> {
  await requireAdminApi();
  const { chapter, course } = await findChapter(chapterId);
  const title = text(form, "title");
  if (!title) return { error: "Chapter title can't be empty." };
  await db.update(chapters).set({ title }).where(eq(chapters.id, chapter.id));
  changed(course.slug);
  return { ok: "Saved." };
}

export async function moveChapter(chapterId: string, delta: number) {
  await requireAdminApi();
  const { chapter, course } = await findChapter(chapterId);
  await db.transaction((tx) =>
    renumberOutline(tx, course.id, (outline) => move(outline, outline.findIndex((c) => c.id === chapter.id), step(delta))),
  );
  changed(course.slug);
}

export async function deleteChapter(chapterId: string) {
  await requireAdminApi();
  const { chapter, course } = await findChapter(chapterId);
  const videos = await db.select(videoColumns).from(lessons).where(eq(lessons.chapterId, chapter.id));
  await db.transaction(async (tx) => {
    await tx.delete(chapters).where(eq(chapters.id, chapter.id)); // its lessons cascade
    await renumberOutline(tx, course.id);
  });
  await deleteVideos(videos.flatMap((v) => [v.videoUid, v.pendingVideoUid]));
  changed(course.slug);
}

// --- Lessons ---------------------------------------------------------------

export async function addLesson(chapterId: string, form: FormData) {
  await requireAdminApi();
  const { chapter, course } = await findChapter(chapterId);
  const title = text(form, "title");
  const kind = text(form, "kind");
  if (!title || !lessonKinds.includes(kind as never)) throw new Error("A lesson needs a title and a kind.");

  const id = await db.transaction(async (tx) => {
    const taken = await tx.select({ slug: lessons.slug }).from(lessons).where(eq(lessons.courseId, course.id));
    const [lesson] = await tx
      .insert(lessons)
      .values({
        courseId: course.id,
        chapterId: chapter.id,
        title,
        kind: kind as (typeof lessonKinds)[number],
        slug: uniqueSlug(slugify(title), taken.map((t) => t.slug)),
        position: 1_000_000, // last in its chapter until renumbered
      })
      .returning({ id: lessons.id });
    await renumberOutline(tx, course.id);
    return lesson.id;
  });
  revalidateCourse(course.slug);
  redirect(`/admin/courses/${course.id}/lessons/${id}`);
}

export async function moveLesson(lessonId: string, delta: number) {
  await requireAdminApi();
  const { lesson, course } = await findLesson(lessonId);
  await db.transaction((tx) =>
    renumberOutline(tx, course.id, (outline) =>
      outline.map((c) =>
        c.id === lesson.chapterId
          ? { ...c, lessons: move(c.lessons, c.lessons.findIndex((l) => l.id === lesson.id), step(delta)) }
          : c,
      ),
    ),
  );
  changed(course.slug);
}

export async function moveLessonToChapter(lessonId: string, form: FormData) {
  await requireAdminApi();
  const { lesson, course } = await findLesson(lessonId);
  const target = text(form, "chapterId");
  await db.transaction((tx) =>
    renumberOutline(tx, course.id, (outline) => {
      if (target === lesson.chapterId || !outline.some((c) => c.id === target)) return outline;
      return outline.map((c) => ({
        ...c,
        lessons: c.id === target ? [...c.lessons, { id: lesson.id }] : c.lessons.filter((l) => l.id !== lesson.id),
      }));
    }),
  );
  changed(course.slug);
}

export async function deleteLesson(lessonId: string) {
  await requireAdminApi();
  const { lesson, course } = await findLesson(lessonId);
  await db.transaction(async (tx) => {
    await tx.delete(lessons).where(eq(lessons.id, lesson.id));
    await renumberOutline(tx, course.id);
  });
  await deleteVideos([lesson.videoUid, lesson.pendingVideoUid]);
  revalidateCourse(course.slug);
  redirect(`/admin/courses/${course.id}`);
}

/** Drops a replacement that is still uploading or processing; the live video stays. */
export async function discardPendingVideo(lessonId: string): Promise<ActionResult> {
  await requireAdminApi();
  const { lesson, course } = await findLesson(lessonId);
  const uid = lesson.pendingVideoUid;
  if (!uid) return { ok: "Nothing to discard." };
  // Conditional: if it was promoted meanwhile, it is the live video now and must stay.
  const cleared = await db
    .update(lessons)
    .set({ pendingVideoUid: null })
    .where(and(eq(lessons.id, lesson.id), eq(lessons.pendingVideoUid, uid)))
    .returning({ id: lessons.id });
  if (cleared.length) await deleteVideos([uid]);
  changed(course.slug);
  return { ok: "Replacement discarded." };
}

export async function updateLesson(lessonId: string, form: FormData): Promise<ActionResult> {
  await requireAdminApi();
  const { lesson, course } = await findLesson(lessonId);
  const title = text(form, "title");
  const slug = text(form, "slug");
  const passPercent = Number(text(form, "passPercent") || lesson.passPercent);
  if (!title) return { error: "Give the lesson a title." };
  if (!SLUG_PATTERN.test(slug)) return { error: "Slug: lowercase letters, numbers and hyphens only." };
  if (!Number.isInteger(passPercent) || passPercent < 1 || passPercent > 100) {
    return { error: "Pass mark must be a whole number from 1 to 100." };
  }
  try {
    await db
      .update(lessons)
      .set({ title, slug, summary: text(form, "summary") || null, isPreview: checked(form, "isPreview"), passPercent })
      .where(eq(lessons.id, lesson.id));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `Another lesson in this course already uses the slug “${slug}”.` };
    throw e;
  }
  changed(course.slug);
  return { ok: "Saved." };
}

/** Local dev only: without a video provider, attach a UID and duration by hand. */
export async function setManualVideo(lessonId: string, form: FormData): Promise<ActionResult> {
  await requireAdminApi();
  const { lesson, course } = await findLesson(lessonId);
  if (videoConfigured()) return { error: "Video uploads are configured; use the uploader." };
  if (lesson.kind !== "video") return { error: "Only video lessons have a video." };
  const videoUid = text(form, "videoUid");
  const durationSeconds = Number(text(form, "durationSeconds"));
  if (!/^[\w-]{1,100}$/.test(videoUid)) return { error: "Video UID: letters, numbers, - and _ only." };
  if (!Number.isInteger(durationSeconds) || durationSeconds < 0) return { error: "Duration is whole seconds." };
  await db.update(lessons).set({ videoUid, durationSeconds }).where(eq(lessons.id, lesson.id));
  changed(course.slug);
  return { ok: "Saved." };
}

// --- Quiz questions --------------------------------------------------------

async function findQuizLesson(lessonId: string) {
  const row = await findLesson(lessonId);
  if (row.lesson.kind !== "quiz") notFound();
  return row;
}

export async function saveQuestion(lessonId: string, questionId: string | null, form: FormData): Promise<ActionResult> {
  await requireAdminApi();
  const { lesson, course } = await findQuizLesson(lessonId);
  const parsed = parseQuestion({
    prompt: text(form, "prompt"),
    options: form.getAll("option").map(String),
    correct: form.getAll("correct").map(Number),
    explanation: text(form, "explanation"),
  });
  if ("error" in parsed) return parsed;

  if (questionId) {
    if (!isUuid(questionId)) notFound();
    const updated = await db
      .update(quizQuestions)
      .set(parsed.question)
      .where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.lessonId, lesson.id)))
      .returning({ id: quizQuestions.id });
    if (!updated.length) notFound();
  } else {
    const existing = await db.select({ id: quizQuestions.id }).from(quizQuestions).where(eq(quizQuestions.lessonId, lesson.id));
    await db.insert(quizQuestions).values({ ...parsed.question, lessonId: lesson.id, position: existing.length + 1 });
  }
  changed(course.slug);
  return { ok: questionId ? "Saved." : "Question added." };
}

/** Rewrites 1-based positions for a quiz's questions after `change` reorders or drops them. */
async function reorderQuestions(lessonId: string, change: (ids: string[]) => string[]) {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(eq(quizQuestions.lessonId, lessonId))
      .orderBy(asc(quizQuestions.position), asc(quizQuestions.id));
    const ids = change(rows.map((r) => r.id));
    for (const [i, id] of ids.entries()) {
      await tx.update(quizQuestions).set({ position: i + 1 }).where(eq(quizQuestions.id, id));
    }
  });
}

export async function moveQuestion(lessonId: string, questionId: string, delta: number) {
  await requireAdminApi();
  const { lesson, course } = await findQuizLesson(lessonId);
  await reorderQuestions(lesson.id, (ids) => move(ids, ids.indexOf(questionId), step(delta)));
  changed(course.slug);
}

export async function deleteQuestion(lessonId: string, questionId: string) {
  await requireAdminApi();
  const { lesson, course } = await findQuizLesson(lessonId);
  if (!isUuid(questionId)) notFound();
  await db.delete(quizQuestions).where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.lessonId, lesson.id)));
  await reorderQuestions(lesson.id, (ids) => ids);
  changed(course.slug);
}


// --- Coupons ----------------------------------------------------------------

export async function createCoupon(courseId: string, form: FormData): Promise<ActionResult> {
  await requireAdminApi();
  const course = await findCourse(courseId);
  const code = normalizeCode(form.get("code"));
  if (!code) return { error: "Codes are 3–32 letters, numbers, - or _." };
  const percentOff = Number(text(form, "percentOff"));
  if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) return { error: "Percent off must be a whole number from 1 to 100." };
  try {
    await db.insert(coupons).values({ courseId: course.id, code, percentOff });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `${code} already exists on this course.` };
    throw e;
  }
  refresh();
  return { ok: `${code} added: ${percentOff}% off.` };
}

export async function setCouponActive(couponId: string, active: boolean) {
  await requireAdminApi();
  if (!isUuid(couponId)) notFound();
  await db.update(coupons).set({ active: Boolean(active) }).where(eq(coupons.id, couponId));
  refresh();
}

export async function deleteCoupon(couponId: string) {
  await requireAdminApi();
  if (!isUuid(couponId)) notFound();
  await db.delete(coupons).where(eq(coupons.id, couponId));
  refresh();
}

// --- Live classes -----------------------------------------------------------

const MAX_LIVE_MINUTES = 8 * 60;

export async function scheduleLiveSession(courseId: string, form: FormData): Promise<ActionResult> {
  await requireAdminApi();
  const course = await findCourse(courseId);
  if (!liveConfigured()) return { error: "Live classes aren't set up: WEBINAR_GG_TOKEN is missing." };
  const title = text(form, "title");
  const startsAt = parseIndiaDateTime(text(form, "startsAt"));
  const durationMinutes = Number(text(form, "durationMinutes"));
  if (!title) return { error: "Give the class a title." };
  if (!startsAt) return { error: "Pick a start date and time." };
  if (startsAt.getTime() < Date.now() - 5 * 60_000) return { error: "The start time is in the past." };
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > MAX_LIVE_MINUTES) {
    return { error: `Length must be a whole number of minutes from 15 to ${MAX_LIVE_MINUTES}.` };
  }
  let webinarId: string;
  try {
    webinarId = await createWebinar({ title: `${course.title}: ${title}`, startsAt, durationMinutes });
  } catch (e) {
    console.error("[live] createWebinar failed", e);
    return { error: "webinar.gg didn't accept the class. Try again in a minute." };
  }
  await db.insert(liveSessions).values({ courseId: course.id, title, startsAt, durationMinutes, webinarId });
  refresh();
  return { ok: `${title} scheduled.` };
}

export async function deleteLiveSession(sessionId: string) {
  await requireAdminApi();
  if (!isUuid(sessionId)) notFound();
  const [session] = await db.delete(liveSessions).where(eq(liveSessions.id, sessionId)).returning();
  // Best effort: a webinar left behind on webinar.gg is harmless; nobody can get a token for it.
  if (session) await deleteWebinar(session.webinarId).catch((e) => console.error(`[live] deleteWebinar ${session.webinarId} failed`, e));
  refresh();
}
