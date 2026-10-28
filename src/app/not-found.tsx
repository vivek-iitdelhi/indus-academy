import Link from "next/link";
import { Accent, ArrowIcon, Container, Eyebrow } from "@/components/ui";

// Where people who hit a dead link usually want to go. /learn sends signed-out visitors to sign in.
const WAYS = [
  { href: "/learn", title: "My courses", body: "Pick up where you left off, or join a live class." },
  { href: "/courses", title: "Browse courses", body: "See everything we teach, live and self-paced." },
  { href: "/", title: "Home", body: "Start again from the front page." },
] as const;

export default function NotFound() {
  return (
    <Container className="grid min-h-[80vh] place-items-center py-16 sm:py-24">
      <div className="relative w-full max-w-3xl">
        <p
          aria-hidden
          className="pointer-events-none absolute -top-16 right-0 select-none font-serif text-[9rem] leading-none italic text-pine/[0.07] sm:-top-24 sm:text-[14rem]"
        >
          404
        </p>
        <Eyebrow>Page not found</Eyebrow>
        <h1 className="relative mt-5 max-w-2xl text-4xl leading-[1.05] font-semibold tracking-[-0.035em] sm:text-6xl">
          This page is still <Accent>in training</Accent>.
        </h1>
        <p className="relative mt-5 max-w-lg text-lg text-muted">
          The link may be old, or the page may have moved. Here&apos;s where most people are headed:
        </p>
        <ul className="relative mt-10 grid gap-3 sm:grid-cols-3">
          {WAYS.map((w) => (
            <li key={w.href}>
              <Link
                href={w.href}
                className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_12px_30px_-18px_rgb(0_0_0/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
              >
                <span className="flex items-center justify-between font-medium">
                  {w.title}
                  <ArrowIcon className="size-4 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
                </span>
                <span className="mt-2 text-sm leading-relaxed text-muted">{w.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}
