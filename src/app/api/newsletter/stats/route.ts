type Contact = { email?: string; unsubscribed?: boolean; created_at?: string };

const RESEND_API = "https://api.resend.com";

async function fetchContacts(path: string, key: string) {
  const res = await fetch(`${RESEND_API}${path}`, {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${path} responded ${res.status}`);
  const body = (await res.json()) as { data?: Contact[] };
  return body.data ?? [];
}

/**
 * Subscriber counts only — no addresses are returned. Protected by
 * STATS_TOKEN so the numbers are not public.
 */
export async function GET(request: Request) {
  const token = process.env.STATS_TOKEN;
  const given = new URL(request.url).searchParams.get("token");
  if (!token || given !== token) return new Response("Unauthorized", { status: 401 });

  const key = process.env.RESEND_API_KEY;
  const segment = process.env.RESEND_SEGMENT_ID;
  if (!key || !segment) {
    return Response.json({ error: "newsletter not configured" }, { status: 503 });
  }

  let contacts: Contact[];
  let source = `segments/${segment}/contacts`;
  try {
    contacts = await fetchContacts(`/segments/${segment}/contacts`, key);
  } catch {
    // Older API shape, or the segment endpoint is unavailable.
    source = "contacts";
    contacts = await fetchContacts("/contacts", key);
  }

  const active = contacts.filter((contact) => !contact.unsubscribed);
  const latest = active
    .map((contact) => contact.created_at ?? "")
    .sort()
    .at(-1);

  return Response.json({
    total: contacts.length,
    active: active.length,
    unsubscribed: contacts.length - active.length,
    newestSignup: latest ? latest.slice(0, 16).replace("T", " ") + " UTC" : null,
    source,
  });
}
