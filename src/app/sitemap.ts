import type { MetadataRoute } from "next";
import { programs } from "@/content/programs";
import { site } from "@/content/site";
import { getAllPosts } from "@/lib/blog";

const routes = [
  { path: "", priority: 1 },
  { path: "/programs", priority: 0.9 },
  { path: "/enterprise", priority: 0.9 },
  { path: "/consulting", priority: 0.8 },
  { path: "/blog", priority: 0.7 },
  { path: "/contact", priority: 0.5 },
  ...programs.map((p) => ({ path: `/programs/${p.slug}`, priority: 0.8 })),
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...routes.map((route) => ({
      url: `${site.url}${route.path}`,
      changeFrequency: "monthly" as const,
      priority: route.priority,
    })),
    ...getAllPosts().map((post) => ({
      url: `${site.url}/blog/${post.slug}`,
      lastModified: post.updated ?? post.date,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
