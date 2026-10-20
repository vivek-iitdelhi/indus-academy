import type { MetadataRoute } from "next";
import { site } from "@/content/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // The LMS is private: keep crawlers out of the learner app, admin and sign-in.
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/learn", "/signin"] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
