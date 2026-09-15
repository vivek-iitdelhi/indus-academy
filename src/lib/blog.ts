import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked, type Tokens } from "marked";

// Articles live in content/blog as Markdown with frontmatter; the filename is the URL slug.
const BLOG_DIR = path.join(process.cwd(), "content/blog");
const WORDS_PER_MINUTE = 220;

export type Post = {
  slug: string;
  title: string;
  seoTitle?: string;
  description: string;
  date: string;
  updated?: string;
  author: string;
  tags: string[];
  related?: string;
  relatedLabel?: string;
  wordCount: number;
  readingMinutes: number;
  html: string;
  headings: { id: string; text: string }[];
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/&amp;|&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function renderMarkdown(markdown: string) {
  const headings: Post["headings"] = [];
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const html = this.parser.parseInline(tokens);
        const text = decodeEntities(html.replace(/<[^>]+>/g, ""));
        const id = slugify(text);
        if (depth === 2) headings.push({ id, text });
        return `<h${depth} id="${id}">${html}</h${depth}>\n`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href) && !href.includes("indusai.academy");
        const attrs = `${title ? ` title="${title}"` : ""}${external ? ' target="_blank" rel="noopener"' : ""}`;
        return `<a href="${href}"${attrs}>${text}</a>`;
      },
    },
  });
  const html = marked.parse(markdown, { async: false });
  return { html, headings };
}

function readPost(file: string): Post {
  const { data, content } = matter(fs.readFileSync(path.join(BLOG_DIR, file), "utf8"));
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const { html, headings } = renderMarkdown(content);
  return {
    slug: file.replace(/\.md$/, ""),
    title: data.title,
    seoTitle: data.seoTitle,
    description: data.description,
    date: data.date,
    updated: data.updated,
    author: data.author,
    tags: data.tags ?? [],
    related: data.related,
    relatedLabel: data.relatedLabel,
    wordCount,
    readingMinutes: Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)),
    html,
    headings,
  };
}

let cache: Post[] | undefined;

export function getAllPosts(): Post[] {
  cache ??= fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".md"))
    .map(readPost)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  return cache;
}

export function getPost(slug: string) {
  return getAllPosts().find((post) => post.slug === slug);
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
