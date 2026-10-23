import type { Metadata } from "next";
import { CourseCard } from "@/components/course-card";
import { JsonLd } from "@/components/json-ld";
import { PageHero } from "@/components/page-hero";
import { Accent, ButtonLink, Container, Section } from "@/components/ui";
import { pageMetadata } from "@/lib/metadata";
import { breadcrumbSchema } from "@/lib/schema";
import { listPublishedCourses } from "./catalog";

// Prerendered; revalidateCourse() refreshes it after admin edits on the server that ran
// them, and the minutely pass brings every other server (AWS runs several) up to date. It is a
// safety net (and fills in a build that ran without a database).
export const revalidate = 60;

export const metadata: Metadata = pageMetadata({
  title: "Self-Paced Online AI Courses",
  description:
    "Self-paced online AI courses from Indus AI Academy: short, practical video lessons with quizzes, lifetime access and a verifiable certificate.",
  path: "/courses",
});

export default async function CoursesPage() {
  const courses = await listPublishedCourses();
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Courses", path: "/courses" },
        ])}
      />
      <PageHero
        eyebrow="Self-paced online courses"
        title={
          <>
            Learn AI at <Accent>your own pace</Accent>.
          </>
        }
        intro="Practical video courses you can start today and finish on your schedule, on your phone or laptop. Lifetime access, and a certificate when you complete every lesson."
      >
        <ButtonLink href="/programs" variant="outline-dark">
          Prefer a live cohort?
        </ButtonLink>
      </PageHero>

      <Section>
        <Container>
          {courses.length ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <p className="text-lg text-muted">New courses are on their way. Check back soon.</p>
          )}
        </Container>
      </Section>
    </>
  );
}
