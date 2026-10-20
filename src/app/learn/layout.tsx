import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
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
          <div className="flex items-center gap-4 text-muted">
            <span className="hidden sm:inline">{user.name || user.email}</span>
            <SignOutButton />
          </div>
        </Container>
      </div>
      {children}
    </>
  );
}
