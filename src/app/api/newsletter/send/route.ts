import { getAllPosts } from "@/lib/blog";
import { digestAlreadySent, newsletterConfigured, sendDigest, todayInIndia } from "@/lib/newsletter";

/**
 * Called once a day by Vercel Cron (see vercel.json), shortly after the blog
 * routine publishes. Emails subscribers the articles dated today, or nothing
 * at all if none were published.
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
  const posts = getAllPosts().filter((post) => post.date === date);
  if (posts.length === 0) {
    return Response.json({ sent: false, date, reason: "no articles published today" });
  }

  const name = `Daily digest ${date}`;
  try {
    if (await digestAlreadySent(name)) {
      return Response.json({ sent: false, date, reason: "digest already sent" });
    }
    await sendDigest(posts, date);
  } catch (error) {
    console.error("[newsletter] digest failed:", error);
    return Response.json({ sent: false, date, error: String(error) }, { status: 500 });
  }

  return Response.json({ sent: true, date, articles: posts.map((post) => post.slug) });
}
