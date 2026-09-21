import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { Container, Eyebrow } from "@/components/ui";
import { legalDocuments } from "@/content/legal";
import { formatDate } from "@/lib/pricing";
import { pageMetadata } from "@/lib/metadata";
import { breadcrumbSchema } from "@/lib/schema";

export const dynamicParams = false;

export function generateStaticParams() {
  return legalDocuments.map((doc) => ({ policy: doc.slug }));
}

const docBySlug = (slug: string) => legalDocuments.find((doc) => doc.slug === slug);

export async function generateMetadata({ params }: PageProps<"/[policy]">): Promise<Metadata> {
  const doc = docBySlug((await params).policy);
  if (!doc) return {};
  return pageMetadata({ title: doc.title, description: doc.description, path: `/${doc.slug}` });
}

export default async function LegalPage({ params }: PageProps<"/[policy]">) {
  const doc = docBySlug((await params).policy);
  if (!doc) notFound();

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: doc.title, path: `/${doc.slug}` },
        ])}
      />
      <Container className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <Eyebrow>Legal</Eyebrow>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl">
            {doc.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">{doc.intro}</p>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-muted">
            Last updated {formatDate(doc.updated)}
          </p>

          <div className="mt-14 space-y-12">
            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-4 leading-relaxed text-muted">
                    {paragraph}
                  </p>
                ))}
                {section.list && (
                  <ul className="mt-4 space-y-2.5">
                    {section.list.map((item) => (
                      <li key={item} className="flex gap-3 leading-relaxed text-muted">
                        <span className="mt-2.5 size-1 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
