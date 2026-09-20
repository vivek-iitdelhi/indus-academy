import type { Metadata } from "next";
import { BlogCard } from "@/components/blog-card";
import { CtaBand } from "@/components/cta-band";
import { JsonLd } from "@/components/json-ld";
import { NewsletterForm } from "@/components/newsletter-form";
import { PageHero } from "@/components/page-hero";
import { Accent, Container, Eyebrow, Section } from "@/components/ui";
import { getAllPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
import { newsletterConfigured } from "@/lib/newsletter";
import { breadcrumbSchema } from "@/lib/schema";

const base = pageMetadata({
  title: "Blog: AI Training, AI Agents & Careers",
  description:
    "Practical guides from Indus AI Academy on AI upskilling for employees, choosing an AI course, becoming an AI generalist and using AI agents in business.",
  path: "/blog",
});

export const metadata: Metadata = {
  ...base,
  alternates: { ...base.alternates, types: { "application/rss+xml": "/blog/rss.xml" } },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ])}
      />
      <PageHero
        eyebrow="Blog"
        title={
          <>
            Practical guides to <Accent>working with AI</Accent>.
          </>
        }
        intro="Straightforward advice on AI upskilling, courses, careers and AI agents, from the team that trains professionals and builds AI systems."
      />

      <Section>
        <Container className="grid gap-5 md:grid-cols-2">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} headingLevel={2} />
          ))}
        </Container>

        <Container className="mt-5" hidden={!newsletterConfigured()}>
          <div className="reveal grid gap-8 rounded-3xl border border-line bg-white/60 p-8 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <Eyebrow>AI updates by email</Eyebrow>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                The week&apos;s AI articles, in your inbox.
              </h2>
              <p className="mt-3 leading-relaxed text-muted">
                One email every Tuesday: each new article with a short summary and a direct link. Nothing else.
              </p>
            </div>
            <NewsletterForm />
          </div>
        </Container>
      </Section>

      <CtaBand
        title={
          <>
            Want your team to <Accent>learn this hands-on</Accent>?
          </>
        }
        body="Our live programs turn these ideas into skills, with real projects built on your own work."
        primary={{ href: "/programs", label: "Explore programs" }}
        secondary={{ href: "/contact?interest=enterprise", label: "Talk to us" }}
      />
    </>
  );
}
