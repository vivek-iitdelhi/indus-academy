import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import photo from "@/assets/vivek-gupta.jpg";
import { BlogCard } from "@/components/blog-card";
import { CtaBand } from "@/components/cta-band";
import { JsonLd } from "@/components/json-ld";
import { NewsletterForm } from "@/components/newsletter-form";
import { Accent, ArrowIcon, Container, Section, SectionHeading } from "@/components/ui";
import { founder } from "@/content/site";
import { formatDate, getAllPosts, getPost } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
import { newsletterConfigured } from "@/lib/newsletter";
import { blogPostingSchema, breadcrumbSchema } from "@/lib/schema";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return pageMetadata({
    title: post.seoTitle ?? post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    absoluteTitle: true,
    article: { publishedTime: post.date, modifiedTime: post.updated, authors: [post.author], tags: post.tags },
  });
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = getPost((await params).slug);
  if (!post) notFound();

  const byFounder = post.author === founder.name;
  const more = getAllPosts()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ];

  return (
    <>
      <JsonLd data={blogPostingSchema(post)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <article>
        <header className="border-b border-line">
          <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <li>
                  <Link href="/" className="hover:text-ink">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/blog" className="hover:text-ink">
                    Blog
                  </Link>
                </li>
              </ol>
            </nav>
            <ul className="mt-8 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <li key={tag} className="rounded-full bg-mint/60 px-3 py-1 text-xs text-pine">
                  {tag}
                </li>
              ))}
            </ul>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-balance sm:text-5xl">
              {post.title}
            </h1>
            <p className="mt-5 text-xl leading-relaxed text-muted">{post.description}</p>
            <div className="mt-8 flex items-center gap-3">
              {byFounder && <Image src={photo} alt="" sizes="44px" className="size-11 rounded-full object-cover" />}
              <div className="text-sm">
                <p className="font-medium">
                  {post.author}
                  {byFounder && <span className="font-normal text-muted"> · {founder.credential}</span>}
                </p>
                <p className="text-muted">
                  <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readingMinutes} min read
                </p>
              </div>
            </div>
          </div>
        </header>

        <Container className="grid gap-12 py-14 sm:py-16 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-20">
          <div className="prose-article mx-auto w-full max-w-[42rem]" dangerouslySetInnerHTML={{ __html: post.html }} />
          {post.headings.length > 0 && (
            <aside className="hidden lg:block">
              <nav aria-label="On this page" className="sticky top-28">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted">On this page</p>
                <ol className="mt-4 space-y-1 border-l border-line text-sm">
                  {post.headings.map((h) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        className="-ml-px block border-l border-transparent py-1 pl-4 text-muted transition-colors hover:border-pine hover:text-ink"
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
          )}
        </Container>

        <div className="mx-auto max-w-[42rem] space-y-4 px-5 pb-20 sm:px-0 lg:ml-[max(1.25rem,calc((100%-80rem)/2+2rem))]">
          {post.related && post.relatedLabel && (
            <Link
              href={post.related}
              className="group flex items-center justify-between gap-6 rounded-3xl bg-pine p-6 text-paper transition-colors hover:bg-pine-2 sm:p-8"
            >
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-mint">Related</p>
                <p className="mt-2 text-xl font-semibold tracking-tight">{post.relatedLabel}</p>
              </div>
              <ArrowIcon className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
          )}
          {byFounder && (
            <div className="flex flex-col gap-5 rounded-3xl border border-line bg-white/60 p-6 sm:flex-row sm:p-8">
              <Image src={photo} alt={founder.name} sizes="64px" className="size-16 shrink-0 rounded-full object-cover" />
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted">About the author</p>
                <p className="mt-2 font-semibold">
                  {founder.name} <span className="font-normal text-muted">· {founder.credential}</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{founder.bio[0]}</p>
                <a
                  href={founder.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-pine underline decoration-pine/30 underline-offset-4 hover:decoration-pine"
                >
                  Connect on LinkedIn
                </a>
              </div>
            </div>
          )}
          <div className="rounded-3xl border border-line bg-white/60 p-6 sm:p-8" hidden={!newsletterConfigured()}>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted">AI updates by email</p>
            <p className="mt-2 text-lg font-semibold tracking-tight">The week&apos;s AI articles, in your inbox.</p>
            <NewsletterForm className="mt-5" />
          </div>
        </div>
      </article>

      {more.length > 0 && (
        <Section className="bg-paper-2">
          <Container>
            <SectionHeading
              eyebrow="Keep reading"
              title={
                <>
                  More from the <Accent>blog</Accent>.
                </>
              }
            />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {more.map((p) => (
                <BlogCard key={p.slug} post={p} />
              ))}
            </div>
          </Container>
        </Section>
      )}

      <div className="pt-20 sm:pt-28">
        <CtaBand
          title={
            <>
              Turn ideas into <Accent>skills</Accent>.
            </>
          }
          body="Live, hands-on AI programs for professionals and teams, with certificates issued by INDUS AI Private Limited."
          primary={{ href: "/programs", label: "Explore programs" }}
          secondary={{ href: "/contact?interest=enterprise", label: "Talk to us" }}
        />
      </div>
    </>
  );
}
