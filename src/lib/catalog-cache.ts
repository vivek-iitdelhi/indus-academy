import { revalidatePath } from "next/cache";

/**
 * Call after any admin change to a course (fields, outline, status, price) so the public
 * catalogue re-renders. The catalogue pages and the sitemap are prerendered; this is how
 * they refresh. It only reaches the server that ran it, so with several servers (AWS)
 * the pages also revalidate every minute.
 */
export function revalidateCourse(slug: string) {
  revalidatePath("/courses");
  revalidatePath(`/courses/${slug}`);
  revalidatePath("/sitemap.xml");
}
