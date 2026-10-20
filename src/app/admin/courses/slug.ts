// Kept apart from @/lib/admin/courses (which imports the database) so the browser can use it.

export const SLUG_PATTERN = /^[a-z0-9-]+$/;

export const slugify = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
