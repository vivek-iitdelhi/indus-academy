import type { MetadataRoute } from "next";
import { site } from "@/content/site";

const routes = ["", "/programs", "/enterprise", "/consulting", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${site.url}${route}`,
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
