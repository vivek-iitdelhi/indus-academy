import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/signin-form";
import { Accent, Container, Eyebrow } from "@/components/ui";
import { googleConfigured } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { getUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getUser()) redirect(next);

  return (
    <Container className="max-w-md! py-24 sm:py-32">
      <Eyebrow>Sign in</Eyebrow>
      <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
        Welcome <Accent>back</Accent>.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        New here? The same link creates your account. No password needed.
      </p>
      {params.error && (
        <p role="alert" className="mt-8 rounded-2xl border border-saffron/50 bg-saffron/10 p-4 text-sm leading-relaxed text-ink">
          That sign-in link has expired or was already used. Enter your email below and we&apos;ll send a new one.
        </p>
      )}
      <div className="mt-8">
        <SignInForm next={next} googleEnabled={googleConfigured()} />
      </div>
    </Container>
  );
}
