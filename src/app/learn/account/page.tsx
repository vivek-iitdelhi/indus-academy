import { Accent, Container, Eyebrow } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";
import { site } from "@/content/site";
import { safeNextPath } from "@/lib/safe-next";
import { requireUser } from "@/lib/session";
import { AccountForm } from "./account-form";

export default async function AccountPage({ searchParams }: PageProps<"/learn/account">) {
  const user = await requireUser("/learn/account");
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeNextPath(next, "") || null : null;

  return (
    <Container className="max-w-xl! py-10 sm:py-16">
      <title>Account</title>
      <Eyebrow>Account</Eyebrow>
      <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em]">
        Your <Accent>details</Accent>
      </h1>

      {nextPath && !user.name.trim() && (
        <p role="status" className="mt-6 rounded-2xl border border-saffron/50 bg-saffron/10 p-4 text-sm leading-relaxed">
          Before you start, tell us your name. It goes on your certificate when you finish the course.
        </p>
      )}

      <div className="mt-8 rounded-3xl border border-line bg-white p-5 sm:p-7">
        <p className="text-sm font-medium">Email</p>
        <p className="mt-1 break-all text-muted">{user.email}</p>
        <hr className="my-6 border-line" />
        <AccountForm name={user.name} phone={user.phone ?? ""} next={nextPath} />
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        Certificates already issued keep the name they were issued with. To change your email, write to{" "}
        <a href={`mailto:${site.email}`} className="text-pine underline underline-offset-4">
          {site.email}
        </a>
        .
      </p>
      <div className="mt-6">
        <SignOutButton className="rounded-full border border-ink/15 px-5 py-2.5 hover:border-ink/40" />
      </div>
    </Container>
  );
}
