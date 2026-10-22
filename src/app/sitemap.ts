import type { MetadataRoute } from "next";
import { listPublishedCourses } from "@/app/courses/catalog";
import { legalDocuments } from "@/content/legal";
import { listSearchableCertificates } from "@/lib/lms/certificates";
import { programs } from "@/content/programs";
import { site } from "@/content/site";
import { tracks } from "@/content/tracks";
import { getAllPosts } from "@/lib/blog";

const routes = [
  { path: "", priority: 1 },
  { path: "/programs", priority: 0.9 },
  { path: "/courses", priority: 0.9 },
  { path: "/enterprise", priority: 0.9 },
  { path: "/consulting", priority: 0.8 },
  { path: "/consulting/book", priority: 0.7 },
  { path: "/blog", priority: 0.7 },
  { path: "/contact", priority: 0.5 },
  ...programs.map((p) => ({ path: `/programs/${p.slug}`, priority: 0.8 })),
  ...tracks.map((t) => ({ path: `/enterprise/${t.slug}`, priority: 0.8 })),
  ...legalDocuments.map((doc) => ({ path: `/${doc.slug}`, priority: 0.3 })),
];

// Courses come from the database; revalidateCourse() and the hourly pass keep this current.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, certificates] = await Promise.all([listPublishedCourses(), listSearchableCertificates().catch(() => [])]);
  return [
    ...[...routes, ...courses.map((c) => ({ path: `/courses/${c.slug}`, priority: 0.8 }))].map((route) => ({
      url: `${site.url}${route.path}`,
      changeFrequency: "monthly" as const,
      priority: route.priority,
    })),
    // Certificate pages, so a holder's name search can find their certificate.
    ...certificates.map((c) => ({
      url: `${site.url}/verify/${c.serial}`,
      lastModified: c.issuedAt,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
    ...getAllPosts().map((post) => ({
      url: `${site.url}/blog/${post.slug}`,
      lastModified: post.updated ?? post.date,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
