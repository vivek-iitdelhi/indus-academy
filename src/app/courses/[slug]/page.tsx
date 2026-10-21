import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { CourseAction } from "@/components/course-action";
import { JsonLd } from "@/components/json-ld";
import { PageHero } from "@/components/page-hero";
import { CheckList, Container, Section, SectionHeading } from "@/components/ui";
import { company, site } from "@/content/site";
import { flattenOutline, totalDurationSeconds } from "@/lib/lms/courses";
import { pageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, ORGANIZATION_ID } from "@/lib/schema";
import { formatDuration, formatLabels, getCatalogCourse, listPublishedCourses, priceLabel } from "../catalog";

// Static per course, built from the database. Courses published after the build render on
// first request and are cached; revalidateCourse() refreshes them, hourly as a safety net.
// Never read the session here: the per-visitor button state comes from CourseAction.
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await listPublishedCourses()).map((course) => ({ slug: course.slug }));
}

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const found = await getCatalogCourse((await params).slug);
  if (!found) return {};
  const { course } = found;
  return pageMetadata({
    title: course.title,
    description: course.subtitle ?? `${course.title}, a self-paced online course from ${site.name}.`,
    path: `/courses/${course.slug}`,
  });
}

export default async function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  const found = await getCatalogCourse((await params).slug);
  if (!found) notFound();
  const { course, outline } = found;

  const lessons = flattenOutline(outline);
  const quizCount = lessons.filter((lesson) => lesson.kind === "quiz").length;
  const videoCount = lessons.length - quizCount;
  const total = formatDuration(totalDurationSeconds(outline));
  const path = `/courses/${course.slug}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Courses", path: "/courses" },
    { name: course.title, path },
  ];
  const youGet = [
    `${videoCount} video lesson${videoCount === 1 ? "" : "s"}, ${total} in total`,
    ...(quizCount ? [`${quizCount} quiz${quizCount === 1 ? "" : "zes"} to check your understanding`] : []),
    "Lifetime access: learn at your own pace, on phone or laptop",
    ...(course.certificateEnabled
      ? [`A certificate from ${company.legalName} when you complete every lesson and pass every quiz`]
      : []),
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: course.title,
          description: course.subtitle ?? course.title,
          url: `${site.url}${path}`,
          provider: { "@type": "EducationalOrganization", "@id": ORGANIZATION_ID, name: site.name, url: site.url },
          inLanguage: "en",
          ...(course.certificateEnabled && {
            educationalCredentialAwarded: `${site.name} certificate, issued by ${company.legalName}`,
          }),
          syllabusSections: outline.map((chapter) => ({ "@type": "Syllabus", name: chapter.title })),
          offers: {
            "@type": "Offer",
            price: course.pricePaise / 100,
            priceCurrency: "INR",
            category: course.pricePaise > 0 ? "Paid" : "Free",
            url: `${site.url}${path}`,
          },
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: "Online",
            courseWorkload: `PT${Math.max(1, Math.round(totalDurationSeconds(outline) / 60))}M`,
          },
        }}
      />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHero eyebrow={formatLabels[course.format]} title={course.title} intro={course.subtitle ?? ""} breadcrumbs={crumbs} />

      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <SectionHeading eyebrow="About this course" title="What you'll learn" />
            {course.description && (
              <div
                className="prose-article mt-8 max-w-[42rem]"
                dangerouslySetInnerHTML={{ __html: marked.parse(course.description, { async: false }) }}
              />
            )}
          </div>

          <div className="space-y-8">
            <div className="rounded-2xl border border-line bg-white/60 p-6">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">Price</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{priceLabel(course.pricePaise)}</p>
              <div className="mt-5">
                <CourseAction slug={course.slug} pricePaise={course.pricePaise} />
              </div>
            </div>
            <div>
              <h3 className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-muted">What you get</h3>
              <div className="mt-5">
                <CheckList items={youGet} />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section id="curriculum" className="bg-paper-2">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
            <SectionHeading eyebrow="Curriculum" title="What's inside" />
            <p className="font-mono text-sm text-muted">
              {lessons.length} lessons · {total}
            </p>
          </div>
          <div className="divide-y divide-line">
            {outline.map((chapter, i) => (
              <div key={chapter.id} className="grid gap-5 py-8 md:grid-cols-[6rem_1fr]">
                <span className="font-mono text-sm text-pine">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{chapter.title}</h3>
                  <ol className="mt-4 space-y-2.5">
                    {chapter.lessons.map((lesson) => (
                      <li key={lesson.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="mt-2.5 size-1 shrink-0 self-start rounded-full bg-saffron" aria-hidden="true" />
                        <span className="text-ink/80">{lesson.title}</span>
                        {lesson.isPreview && (
                          <Link
                            href={`/learn/${course.slug}/${lesson.slug}`}
                            className="rounded-full bg-mint/60 px-2.5 py-0.5 text-xs font-medium text-pine hover:bg-mint"
                          >
                            Free preview
                          </Link>
                        )}
                        <span className="ml-auto font-mono text-xs text-muted">
                          {lesson.kind === "quiz" ? "Quiz" : formatDuration(lesson.durationSeconds)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
