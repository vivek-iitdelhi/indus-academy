import type { Metadata } from "next";
import { site } from "@/content/site";

// Child segments replace nested metadata objects (openGraph, twitter) wholesale,
// so every page builds its complete set here instead of relying on the layout.
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  article,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  article?: { publishedTime: string; modifiedTime?: string; authors: string[]; tags: string[] };
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${site.name}`;
  const shared = { siteName: site.name, locale: "en_IN", url: path, title: fullTitle, description };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: article ? { type: "article", ...shared, ...article } : { type: "website", ...shared },
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}
