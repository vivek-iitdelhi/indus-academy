import photo from "@/assets/vivek-gupta.jpg";
import type { Program } from "@/content/programs";
import type { Post } from "@/lib/blog";
import { company, founder, site } from "@/content/site";

const absolute = (path = "") => `${site.url}${path}`;

export const ORGANIZATION_ID = absolute("/#organization");
const FOUNDER_ID = absolute("/#founder");
const WEBSITE_ID = absolute("/#website");

const organizationRef = { "@type": "EducationalOrganization", "@id": ORGANIZATION_ID, name: site.name, url: absolute() };

// Rendered on every page from the root layout; other schemas reference these entities by @id.
export const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "EducationalOrganization",
      "@id": ORGANIZATION_ID,
      name: site.name,
      url: absolute(),
      logo: absolute("/apple-icon"),
      description: site.description,
      email: site.email,
      foundingDate: company.founded,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Greater Noida",
        addressRegion: "Uttar Pradesh",
        addressCountry: "IN",
      },
      areaServed: { "@type": "Country", name: "India" },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        email: site.email,
        areaServed: "IN",
        availableLanguage: "English",
      },
      parentOrganization: { "@type": "Organization", name: company.legalName, foundingDate: company.founded },
      founder: { "@id": FOUNDER_ID },
    },
    {
      "@type": "Person",
      "@id": FOUNDER_ID,
      name: founder.name,
      jobTitle: `${founder.role}, ${site.name}`,
      image: absolute(photo.src),
      sameAs: [founder.linkedin],
      alumniOf: {
        "@type": "CollegeOrUniversity",
        name: "Indian Institute of Technology Delhi",
        url: "https://home.iitd.ac.in/",
      },
      worksFor: { "@id": ORGANIZATION_ID },
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: site.name,
      url: absolute(),
      inLanguage: "en-IN",
      publisher: { "@id": ORGANIZATION_ID },
    },
  ],
};

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}

export function faqSchema(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function courseSchema(program: Program) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: program.name,
    description: program.summary,
    url: absolute(`/programs/${program.slug}`),
    provider: organizationRef,
    inLanguage: "en",
    educationalLevel: program.level,
    audience: { "@type": "Audience", audienceType: program.audience },
    teaches: program.outcomes,
    educationalCredentialAwarded: `${site.name} certificate, issued by ${company.legalName}`,
    ...(program.modules && {
      syllabusSections: program.modules.map((m) => ({
        "@type": "Syllabus",
        name: m.title,
        description: m.topics.join("; "),
        timeRequired: `PT${m.hours}H`,
      })),
    }),
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: program.mode,
      ...(program.workloadHours && { courseWorkload: `PT${program.workloadHours}H` }),
      instructor: { "@id": FOUNDER_ID },
    },
  };
}

export function serviceSchema({
  name,
  serviceType,
  description,
  path,
}: {
  name: string;
  serviceType: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    serviceType,
    description,
    url: absolute(path),
    provider: organizationRef,
    areaServed: { "@type": "Country", name: "India" },
  };
}

export function blogPostingSchema(post: Post) {
  const url = absolute(`/blog/${post.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    inLanguage: "en-IN",
    keywords: post.tags.join(", "),
    wordCount: post.wordCount,
    url,
    mainEntityOfPage: url,
    image: `${url}/opengraph-image`,
    author:
      post.author === founder.name
        ? { "@type": "Person", "@id": FOUNDER_ID, name: founder.name, url: founder.linkedin }
        : { "@type": "Person", name: post.author },
    publisher: organizationRef,
  };
}
