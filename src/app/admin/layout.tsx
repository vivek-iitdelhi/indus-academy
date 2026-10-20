import type { Metadata } from "next";
import { SignOutButton } from "@/components/sign-out-button";
import { Container, Eyebrow } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Layouts do not re-run on client navigation: admin pages, route handlers and server
// actions must call requireAdmin()/requireAdminApi() themselves too.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <Eyebrow>Admin</Eyebrow>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>{admin.email}</span>
          <SignOutButton />
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[12rem_1fr]">
        <aside>
          <AdminNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
