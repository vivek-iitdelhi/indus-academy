import Link from "next/link";
import { formatDate, type Post } from "@/lib/blog";

export function BlogCard({ post, headingLevel = 3 }: { post: Post; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="reveal group flex flex-col rounded-3xl border border-line bg-white/50 p-7 transition-colors hover:border-ink/25 hover:bg-white"
    >
      <ul className="flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <li key={tag} className="rounded-full bg-mint/60 px-3 py-1 text-xs text-pine">
            {tag}
          </li>
        ))}
      </ul>
      <Heading className="mt-6 text-xl font-semibold leading-snug tracking-tight group-hover:text-pine">
        {post.title}
      </Heading>
      <p className="mt-3 text-sm leading-relaxed text-muted">{post.description}</p>
      <p className="mt-auto pt-8 font-mono text-xs text-muted">
        <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readingMinutes} min read
      </p>
    </Link>
  );
}
