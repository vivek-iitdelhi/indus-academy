import { Accent, Container, Eyebrow } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";
import { ButtonLink } from "@/components/ui";
import { site } from "@/content/site";
import { safeNextPath } from "@/lib/safe-next";
import { isAdminEmail, requireUser } from "@/lib/session";
import { AccountForm } from "./account-form";

export default async function AccountPage({ searchParams }: PageProps<"/learn/account">) {
  const user = await requireUser("/learn/account");
  const { next, welcome } = await searchParams;
  const nextPath = typeof next === "string" ? safeNextPath(next, "") || null : null;
  // Accounts from before first/last names were asked for: start from the full name.
  const [first = "", ...rest] = user.name.trim().split(/\s+/);
  const firstName = user.firstName ?? first;
  const lastName = user.lastName ?? rest.join(" ");

  return (
    <Container className="max-w-xl! py-10 sm:py-16">
      <title>Account</title>
      <Eyebrow>Account</Eyebrow>
      <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em]">
        Your <Accent>details</Accent>
      </h1>

      {welcome ? (
        <p role="status" className="mt-6 rounded-2xl border border-saffron/50 bg-saffron/10 p-4 text-sm leading-relaxed">
          Welcome! To finish signing up, tell us your name (and a phone number, if you like).
        </p>
      ) : (
        nextPath &&
        !user.name.trim() && (
          <p role="status" className="mt-6 rounded-2xl border border-saffron/50 bg-saffron/10 p-4 text-sm leading-relaxed">
            Before you start, tell us your name. It goes on your certificate when you finish the course.
          </p>
        )
      )}

      <div className="mt-8 rounded-3xl border border-line bg-white p-5 sm:p-7">
        <p className="text-sm font-medium">Email</p>
        <p className="mt-1 break-all text-muted">{user.email}</p>
        <hr className="my-6 border-line" />
        <AccountForm firstName={firstName} lastName={lastName} phone={user.phone ?? ""} next={nextPath ?? (welcome ? "/learn" : null)} />
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        Certificates already issued keep the name they were issued with. To change your email, write to{" "}
        <a href={`mailto:${site.email}`} className="text-pine underline underline-offset-4">
          {site.email}
        </a>
        .
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SignOutButton className="rounded-full border border-ink/15 px-5 py-2.5 hover:border-ink/40" />
        {(await isAdminEmail(user.email)) && (
          <ButtonLink href="/admin" variant="outline" className="h-10 lg:hidden">
            Admin
          </ButtonLink>
        )}
      </div>
    </Container>
  );
}
