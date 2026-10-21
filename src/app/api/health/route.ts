import { sql } from "drizzle-orm";
import { db } from "@/db";

const REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "RESEND_API_KEY"];

/**
 * Public health check for uptime monitors and for diagnosing a deployment from outside:
 * whether the database answers, and which required settings are missing (names only,
 * never values). 503 when anything is wrong.
 */
export async function GET() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  let database = "ok";
  if (!process.env.DATABASE_URL) database = "not configured";
  else {
    try {
      await db.execute(sql`select 1`);
    } catch (error) {
      // A Postgres error code (28P01 = bad password) or a network code (ENOTFOUND, ECONNREFUSED).
      const { code } = (error as { cause?: { code?: string } }).cause ?? (error as { code?: string });
      database = `unreachable (${code ?? "unknown error"})`;
    }
  }
  const ok = database === "ok" && !missing.length;
  return Response.json({ ok, database, missing }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
