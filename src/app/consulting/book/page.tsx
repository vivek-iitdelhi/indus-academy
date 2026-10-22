import type { Metadata } from "next";
import { BookCall } from "@/components/book-call";
import { PageHero } from "@/components/page-hero";
import { Accent, ButtonLink, CheckList, Container, Section } from "@/components/ui";
import { discoveryCall } from "@/content/consulting";
import { HOLD_MINUTES } from "@/lib/bookings";
import { cashfreeConfigured } from "@/lib/cashfree";
import { pageMetadata } from "@/lib/metadata";
import { formatRupees } from "@/lib/rupees";

export const metadata: Metadata = pageMetadata({
  title: "Book an AI Discovery Call",
  description: `Book a ${discoveryCall.minutes}-minute AI discovery call with Indus AI Academy: pick a time, pay online, and get a calendar invite and GST invoice.`,
  path: "/consulting/book",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "AI consulting", path: "/consulting" },
  { name: "Book a call", path: "/consulting/book" },
];

export default function BookCallPage() {
  const discounted = discoveryCall.price < discoveryCall.listPrice;
  return (
    <>
      <PageHero
        eyebrow={`${discoveryCall.minutes}-minute discovery call`}
        title={
          <>
            Talk through your AI idea with <Accent>someone who builds it</Accent>.
          </>
        }
        intro="Pick a time that suits you, pay online, and the calendar invite and meeting link land in your inbox straight away."
        breadcrumbs={crumbs}
      />

      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div className="space-y-8">
            <div>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">Price</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {formatRupees(discoveryCall.price * 100)}
                {discounted && (
                  <span className="ml-2 text-lg font-normal text-muted line-through">
                    {formatRupees(discoveryCall.listPrice * 100)}
                  </span>
                )}
                <span className="ml-2 text-base font-normal text-muted">+ GST</span>
              </p>
              {discounted && (
                <p className="mt-2 inline-block rounded-lg bg-saffron/15 px-3 py-1.5 text-sm">
                  <span className="font-medium">
                    {Math.round((1 - discoveryCall.price / discoveryCall.listPrice) * 100)}% off
                  </span>{" "}
                  for a limited time.
                </p>
              )}
            </div>
            <CheckList
              items={[
                `${discoveryCall.minutes} minutes, one to one, on video`,
                "Your use case reviewed: is AI the right answer, and what would it take?",
                "A clear next step, whether or not you work with us",
                "GST invoice for your company, if you need one",
              ]}
            />
            <p className="text-sm leading-relaxed text-muted">
              Need to reschedule? Reply to your confirmation email at least 24 hours before the call.
            </p>
          </div>

          <div className="rounded-3xl border border-line bg-white/60 p-6 sm:p-8">
            {cashfreeConfigured() ? (
              <BookCall price={discoveryCall.price} holdMinutes={HOLD_MINUTES} />
            ) : (
              <>
                <p className="leading-relaxed text-muted">Online booking opens shortly. Tell us when suits you and we&apos;ll set it up.</p>
                <ButtonLink href="/contact?interest=consulting" variant="dark" className="mt-5 w-full">
                  Book a discovery call
                </ButtonLink>
              </>
            )}
          </div>
        </Container>
      </Section>
    </>
  );
}
