import Link from "next/link";
import { classTimes, formatDuration, formatLabels, formatRupees, percentOff, priceLabel, type CatalogCourse } from "@/app/courses/catalog";
import type { Course } from "@/db/schema";
import { NextClass } from "./live-schedule";
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
      {course.format === "live" && (
        <NextClass classes={classTimes(course.liveClasses)} className="mt-6 text-sm font-medium" />
      )}
      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm">
        {(course.format === "live"
          ? [
              ["Live classes", String(course.liveClasses.length)],
              ["Recordings", `Kept ${course.recordingDays} days`],
            ]
          : [
              ["Length", formatDuration(course.totalSeconds)],
              ["Lessons", String(course.lessonCount)],
            ]
        ).map(([term, detail]) => (
          <div key={term} className="bg-paper p-5">
            <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">{term}</dt>
            <dd className="mt-2 font-medium leading-snug">{detail}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-lg font-semibold tracking-tight">
        <CoursePrice course={course} />
      </p>
      <div className="mt-auto pt-8">
        <ButtonLink href={href} variant="dark">
          View course
        </ButtonLink>
      </div>
    </article>
  );
}

/** The price, with the list price struck through and the saving when discounted. */
export function CoursePrice({ course }: { course: Pick<Course, "pricePaise" | "listPricePaise"> }) {
  const off = percentOff(course);
  return (
    <>
      {priceLabel(course.pricePaise)}
      {off > 0 && (
        <>
          <span className="ml-2 font-normal text-muted line-through">{formatRupees(course.listPricePaise!)}</span>
          <span className="ml-2 rounded-full bg-saffron/20 px-2 py-0.5 align-middle text-[0.6em] font-medium text-ink">{off}% off</span>
        </>
      )}
    </>
  );
}
