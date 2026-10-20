import Link from "next/link";
import { formatDuration, formatLabels, priceLabel, type CatalogCourse } from "@/app/courses/catalog";
import { ButtonLink } from "./ui";

export function CourseCard({ course }: { course: CatalogCourse }) {
  const href = `/courses/${course.slug}`;
  return (
    <article className="reveal flex flex-col rounded-3xl border border-line bg-white/50 p-8 sm:p-10">
      <span className="font-mono text-xs uppercase tracking-[0.16em] text-pine">{formatLabels[course.format]}</span>
      <h2 className="mt-6 text-3xl font-semibold tracking-tight">
        <Link href={href} className="hover:text-pine">
          {course.title}
        </Link>
      </h2>
      {course.subtitle && <p className="mt-3 font-serif text-xl italic text-pine">{course.subtitle}</p>}
      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm">
        {[
          ["Length", formatDuration(course.totalSeconds)],
          ["Lessons", String(course.lessonCount)],
        ].map(([term, detail]) => (
          <div key={term} className="bg-paper p-5">
            <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">{term}</dt>
            <dd className="mt-2 font-medium leading-snug">{detail}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-lg font-semibold tracking-tight">{priceLabel(course.pricePaise)}</p>
      <div className="mt-auto pt-8">
        <ButtonLink href={href} variant="dark">
          View course
        </ButtonLink>
      </div>
    </article>
  );
}
