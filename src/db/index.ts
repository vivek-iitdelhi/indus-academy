import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

// One client per process. Dev HMR re-evaluates modules, so park it on globalThis
// rather than opening a new pool on every edit.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

// prepare: false because Supabase's pooler runs in transaction mode, which cannot
// hold prepared statements across transactions. The client connects lazily.
const client = globalForDb.pgClient ?? postgres(process.env.DATABASE_URL ?? "", { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
