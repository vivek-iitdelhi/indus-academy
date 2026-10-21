import { asc } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { formatDate } from "@/lib/admin/ops";
import { envAdmins, requireAdmin } from "@/lib/session";
import { ActionForm } from "../learners/action-form";
import { Badge, btn, btnDark, input, PageTitle, Table } from "../learners/admin-ui";
import { addAdmin, removeAdmin } from "./actions";

export default async function AdminAdminsPage() {
  const me = await requireAdmin();
  const rows = await db.select().from(admins).orderBy(asc(admins.createdAt));
  const fromSettings = envAdmins().filter((email) => !rows.some((r) => r.email === email));

  return (
    <div>
      <PageTitle intro="Admins can open this panel and change everything in it. Add someone by the email they sign in with; they don't need an account yet.">
        Admins
      </PageTitle>

      <ActionForm action={addAdmin} className="mt-8 flex flex-wrap items-center gap-3">
        <input name="email" type="email" required placeholder="name@example.com" aria-label="Email" className={`${input} max-w-sm`} />
        <button type="submit" className={btnDark}>
          Add admin
        </button>
      </ActionForm>

      <Table head={["Email", "Added", "By", ""]} empty="No admins yet.">
        {[
          ...rows.map((r) => (
            <tr key={r.email}>
              <td>
                {r.email} {r.email === me.email.toLowerCase() && <Badge>You</Badge>}
              </td>
              <td className="whitespace-nowrap">{formatDate(r.createdAt)}</td>
              <td>{r.addedBy ?? "Setup"}</td>
              <td className="text-right">
                {r.email !== me.email.toLowerCase() && (
                  <ActionForm action={removeAdmin} confirm={`Remove ${r.email} as an admin?`}>
                    <input type="hidden" name="email" value={r.email} />
                    <button type="submit" className={btn}>
                      Remove
                    </button>
                  </ActionForm>
                )}
              </td>
            </tr>
          )),
          ...fromSettings.map((email) => (
            <tr key={email}>
              <td>
                {email} {email === me.email.toLowerCase() && <Badge>You</Badge>}
              </td>
              <td colSpan={3} className="text-muted">
                Server setting (ADMIN_EMAILS)
              </td>
            </tr>
          )),
        ]}
      </Table>
    </div>
  );
}
