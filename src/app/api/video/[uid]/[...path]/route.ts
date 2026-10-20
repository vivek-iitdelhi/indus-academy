import { playlistFor } from "@/lib/video";

const CORS = { "access-control-allow-origin": "*" }; // distributors play on their own sites

/**
 * HLS playlists for the holder of a playback token (`?t=`). Segment URLs inside are
 * presigned and expire with the token; the segments themselves come straight from storage.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/video/[uid]/[...path]">) {
  const { uid, path } = await ctx.params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const playlist = await playlistFor(uid, path.join("/"), token).catch((e) => {
    console.error(`playlist ${uid}/${path.join("/")} failed`, e);
    return undefined;
  });
  if (playlist === undefined) return new Response("Video storage unavailable", { status: 502, headers: CORS });
  if (playlist === null) return new Response("Not found or link expired", { status: 404, headers: CORS });
  return new Response(playlist, {
    headers: { ...CORS, "content-type": "application/vnd.apple.mpegurl", "cache-control": "private, max-age=300" },
  });
}
