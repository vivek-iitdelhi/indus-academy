import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "My learning",
  robots: { index: false, follow: false },
};

// Layouts do not re-run on client navigation, and cannot see the nested path for the
// sign-in redirect: every /learn page must call requireUser("/learn/...") itself too.
export default async function LearnLayout({ children }: LayoutProps<"/learn">) {
  const user = await requireUser("/learn");
  return (
    <>
      <div className="border-b border-line bg-paper-2/60">
        <Container className="flex h-12 items-center justify-between gap-4 text-sm">
          <Link href="/learn" className="font-medium text-ink hover:text-pine">
            My learning
          </Link>
          <nav aria-label="Learner" className="flex min-w-0 items-center gap-5 text-muted">
            <Link href="/learn/certificates" className="hover:text-ink">
              Certificates
            </Link>
            <Link href="/learn/account" className="max-w-40 truncate hover:text-ink">
              {user.name || "Account"}
            </Link>
          </nav>
        </Container>
      </div>
      {children}
    </>
  );
}
