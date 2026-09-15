import type { Metadata } from "next";
import { BlogCard } from "@/components/blog-card";
import { CtaBand } from "@/components/cta-band";
import { JsonLd } from "@/components/json-ld";
import { PageHero } from "@/components/page-hero";
import { Accent, Container, Section } from "@/components/ui";
import { getAllPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
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
