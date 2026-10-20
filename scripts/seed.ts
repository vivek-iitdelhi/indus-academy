// Seeds two published demo courses. Idempotent: courses upsert by slug, lessons by
// (course, slug), chapters and questions by position, so learner progress survives re-runs.
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { chapters, courses, lessons, quizQuestions, type CourseFormat } from "../src/db/schema.ts";

type SeedQuestion = { prompt: string; options: string[]; correct: number[]; explanation: string };
type SeedLesson =
  | { kind: "video"; slug: string; title: string; summary: string; videoUid: string; durationSeconds: number; isPreview?: boolean }
  | { kind: "quiz"; slug: string; title: string; summary: string; questions: SeedQuestion[] };
type SeedCourse = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  format: CourseFormat;
  pricePaise: number;
  sequential: boolean;
  chapters: { title: string; lessons: SeedLesson[] }[];
};

const seedCourses: SeedCourse[] = [
  {
    slug: "ai-at-work-essentials",
    title: "AI at Work: Essentials",
    subtitle: "Use AI assistants confidently in your everyday work",
    description:
      "Short videos and quick checks that take you from your first prompt to real work: summarising documents, drafting emails and building reports with AI.\n\n- Bite-sized 4–5 minute lessons\n- A short quiz after each chapter\n- Certificate on completion",
    format: "interactive",
    pricePaise: 149900,
    sequential: true,
    chapters: [
      {
        title: "Getting started with AI assistants",
        lessons: [
          { kind: "video", slug: "what-ai-can-do", title: "What AI assistants can (and can't) do", summary: "A plain-English tour of what today's assistants are good at.", videoUid: "seed-video-1", durationSeconds: 272, isPreview: true },
          {
            kind: "quiz",
            slug: "check-the-basics",
            title: "Check: the basics",
            summary: "Three quick questions on what you just watched.",
            questions: [
              { prompt: "Which task is an AI assistant best suited to?", options: ["Guaranteeing facts are correct", "Drafting a first version of an email", "Replacing your judgement", "Storing passwords"], correct: [1], explanation: "Assistants are strong at first drafts; you still check the facts." },
              { prompt: "Which of these should you avoid pasting into a public AI tool?", options: ["A public news article", "Customer personal data", "Your own meeting notes with names removed", "A generic job description"], correct: [1], explanation: "Personal data needs your organisation's approved tools." },
              { prompt: "Which make a prompt better? Select all that apply.", options: ["Stating the audience", "Giving an example of the output", "Using all capital letters", "Saying how long the answer should be"], correct: [0, 1, 3], explanation: "Audience, examples and length all steer the output; shouting does not." },
            ],
          },
          { kind: "video", slug: "your-first-prompt", title: "Writing your first useful prompt", summary: "Role, task, context, format: a structure that works.", videoUid: "seed-video-2", durationSeconds: 298 },
        ],
      },
      {
        title: "Putting AI to work",
        lessons: [
          { kind: "video", slug: "summarising-documents", title: "Summarising long documents", summary: "Turn a 40-page report into the five points that matter.", videoUid: "seed-video-3", durationSeconds: 255 },
          {
            kind: "quiz",
            slug: "check-your-workflow",
            title: "Check: your workflow",
            summary: "Three questions on using AI for real work.",
            questions: [
              { prompt: "After AI summarises a contract, what should you do?", options: ["Send the summary as-is", "Check key clauses against the original", "Delete the original", "Ask a second AI and average the answers"], correct: [1], explanation: "Summaries can drop or invent details; verify what matters." },
              { prompt: "What helps AI draft an email in your voice?", options: ["An example of an email you wrote", "A longer subject line", "Asking it to be creative", "Nothing; it already knows you"], correct: [0], explanation: "A real example is the fastest way to match tone." },
              { prompt: "Which are good uses of AI for reports? Select all that apply.", options: ["Suggesting a structure", "Rewriting for a different audience", "Inventing figures you don't have", "Spotting unclear sentences"], correct: [0, 1, 3], explanation: "Never let it fill in numbers you don't have." },
            ],
          },
          { kind: "video", slug: "drafting-emails-and-reports", title: "Drafting emails and reports", summary: "From blank page to a draft you only need to polish.", videoUid: "seed-video-4", durationSeconds: 287 },
        ],
      },
    ],
  },
  {
    slug: "chatgpt-for-professionals",
    title: "ChatGPT for Professionals",
    subtitle: "The complete three-hour masterclass",
    description:
      "The full recorded masterclass on using ChatGPT across research, writing, analysis and planning. Watch at your own pace and earn a certificate.",
    format: "standard",
    pricePaise: 99900,
    sequential: false,
    chapters: [
      {
        title: "Masterclass",
        lessons: [
          { kind: "video", slug: "masterclass", title: "ChatGPT for Professionals: full masterclass", summary: "The complete session, start to finish.", videoUid: "seed-video-5", durationSeconds: 3 * 60 * 60 },
        ],
      },
    ],
  },
];

async function seedCourse(c: SeedCourse) {
  const values = {
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    description: c.description,
    format: c.format,
    status: "published" as const,
    pricePaise: c.pricePaise,
    sequential: c.sequential,
  };
  const [course] = await db
    .insert(courses)
    .values(values)
    .onConflictDoUpdate({ target: courses.slug, set: values })
    .returning({ id: courses.id });

  let lessonPosition = 0;
  for (const [chapterIndex, ch] of c.chapters.entries()) {
    const position = chapterIndex + 1;
    const [existing] = await db
      .select({ id: chapters.id })
      .from(chapters)
      .where(and(eq(chapters.courseId, course.id), eq(chapters.position, position)));
    const chapterId = existing
      ? (await db.update(chapters).set({ title: ch.title }).where(eq(chapters.id, existing.id)).returning())[0].id
      : (await db.insert(chapters).values({ courseId: course.id, title: ch.title, position }).returning())[0].id;

    for (const l of ch.lessons) {
      const lessonValues = {
        courseId: course.id,
        chapterId,
        slug: l.slug,
        title: l.title,
        kind: l.kind,
        position: ++lessonPosition,
        summary: l.summary,
        videoUid: l.kind === "video" ? l.videoUid : null,
        durationSeconds: l.kind === "video" ? l.durationSeconds : 0,
        isPreview: l.kind === "video" && Boolean(l.isPreview),
      };
      const [lesson] = await db
        .insert(lessons)
        .values(lessonValues)
        .onConflictDoUpdate({ target: [lessons.courseId, lessons.slug], set: lessonValues })
        .returning({ id: lessons.id });

      if (l.kind !== "quiz") continue;
      for (const [qi, q] of l.questions.entries()) {
        const qValues = { lessonId: lesson.id, position: qi + 1, ...q };
        const [found] = await db
          .select({ id: quizQuestions.id })
          .from(quizQuestions)
          .where(and(eq(quizQuestions.lessonId, lesson.id), eq(quizQuestions.position, qi + 1)));
        if (found) await db.update(quizQuestions).set(qValues).where(eq(quizQuestions.id, found.id));
        else await db.insert(quizQuestions).values(qValues);
      }
    }
  }
  console.log(`seeded ${c.slug}`);
}

for (const c of seedCourses) await seedCourse(c);
process.exit(0);
