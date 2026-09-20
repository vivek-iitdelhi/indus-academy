import { getAllPosts } from "@/lib/blog";
import { digestAlreadySent, newsletterConfigured, sendDigest, todayInIndia } from "@/lib/newsletter";

const DIGEST_DAYS = 7;

/**
 * Called weekly by Vercel Cron (see vercel.json: Tuesdays, 04:30 UTC =
 * 10:00 AM IST). Emails subscribers the articles published since the last
 * digest, or nothing at all if there were none.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!newsletterConfigured()) {
    return Response.json({ sent: false, reason: "newsletter not configured" }, { status: 503 });
  }

  const date = todayInIndia();
  const since = new Date(Date.now() - DIGEST_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const posts = getAllPosts().filter((post) => post.date > since);
  if (posts.length === 0) {
    return Response.json({ sent: false, date, reason: `no articles published since ${since}` });
  }

  const name = `Weekly digest ${date}`;
  try {
    if (await digestAlreadySent(name)) {
      return Response.json({ sent: false, date, reason: "digest already sent" });
    }
    await sendDigest(posts, date);
  } catch (error) {
    console.error("[newsletter] digest failed:", error);
    return Response.json({ sent: false, date, error: String(error) }, { status: 500 });
  }

  return Response.json({ sent: true, date, since, articles: posts.map((post) => post.slug) });
}
