import { revalidatePath } from "next/cache";

/**
 * Call after any admin change to a course (fields, outline, status, price) so the public
 * catalogue re-renders. The catalogue pages and the sitemap are prerendered; this is how
 * they refresh (the pages also revalidate hourly as a safety net).
 */
export function revalidateCourse(slug: string) {
  revalidatePath("/courses");
  revalidatePath(`/courses/${slug}`);
  revalidatePath("/sitemap.xml");
}
