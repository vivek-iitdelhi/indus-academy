import { revalidatePath } from "next/cache";

/**
 * Call after any admin change to a course (fields, outline, status, price) so the public
 * catalogue re-renders. The catalogue pages are prerendered; this is how they refresh.
 */
export function revalidateCourse(slug: string) {
  revalidatePath("/courses");
  revalidatePath(`/courses/${slug}`);
}
