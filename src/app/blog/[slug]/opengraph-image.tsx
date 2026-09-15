import { getPost } from "@/lib/blog";
import { renderOgImage } from "@/lib/og";

export const alt = "Indus AI Academy blog article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  return renderOgImage({
    eyebrow: "Blog",
    title: post?.title ?? "Practical guides to working with AI",
    subtitle: post ? `By ${post.author} · ${post.readingMinutes} min read` : "Indus AI Academy",
  });
}
