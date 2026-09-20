import type { Metadata } from "next";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";
import { site } from "@/content/site";
import { addSubscriber, newsletterConfigured, verifySubscription } from "@/lib/newsletter";

export const metadata: Metadata = {
  title: "Confirm your subscription",
  robots: { index: false, follow: false },
};

type Outcome = { heading: string; body: string };

const OUTCOMES: Record<string, Outcome> = {
  valid: {
    heading: "You're subscribed.",
    body: "You'll get an email whenever we publish, with a short summary and a link to the article. Nothing else.",
  },
  expired: {
    heading: "That link has expired.",
    body: "Confirmation links last 48 hours. Subscribe again from the blog and we'll send a fresh one.",
  },
  invalid: {
    heading: "That link didn't work.",
    body: "It looks incomplete or altered. Please subscribe again from the blog page.",
  },
  failed: {
    heading: "Something went wrong.",
    body: `We couldn't add you to the list. Please try again, or email us at ${site.email}.`,
  },
};

export default async function ConfirmPage({ searchParams }: PageProps<"/newsletter/confirm">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
  const token = typeof params.token === "string" ? params.token : "";

  let result: keyof typeof OUTCOMES = "invalid";
  if (email && token && newsletterConfigured()) {
    result = verifySubscription(email, token);
    if (result === "valid") {
      try {
        await addSubscriber(email);
      } catch (error) {
        console.error("[newsletter] could not add subscriber:", error);
        result = "failed";
      }
    }
  }

  const outcome = OUTCOMES[result];

  return (
    <Container className="py-28 text-center sm:py-36">
      <div className="flex justify-center">
        <Eyebrow>Newsletter</Eyebrow>
      </div>
      <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{outcome.heading}</h1>
      <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-muted">{outcome.body}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/blog" variant="dark">
          Read the blog
        </ButtonLink>
        <ButtonLink href="/programs" variant="outline">
          Explore programs
        </ButtonLink>
      </div>
    </Container>
  );
}
