import { KEY_PROOF_HEADER, playlistFor, videoKeyFor } from "@/lib/video";

// Players run only on our own pages (the site and /embed for partners), so there are no CORS
// headers: another site's script cannot read playlists or the key.

/**
 * HLS playlists for the holder of a playback token (`?t=`), and the segments' decryption key
 * (`key`) for a holder who also sends the player's proof header. Segment URLs inside playlists
 * are presigned and expire with the token; the segments themselves come straight from storage.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/video/[uid]/[...path]">) {
  const { uid, path } = await ctx.params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const file = path.join("/");

  if (file === "key") {
    const key = await videoKeyFor(uid, token, request.headers.get(KEY_PROOF_HEADER) ?? "").catch((e) => {
      console.error(`key ${uid} failed`, e);
      return undefined;
    });
    if (key === undefined) return new Response("Video storage unavailable", { status: 502 });
    if (key === null) return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
    return new Response(new Uint8Array(key), {
      headers: { "content-type": "application/octet-stream", "cache-control": "private, no-store" },
    });
  }

  const playlist = await playlistFor(uid, file, token).catch((e) => {
    console.error(`playlist ${uid}/${file} failed`, e);
    return undefined;
  });
  if (playlist === undefined) return new Response("Video storage unavailable", { status: 502 });
  if (playlist === null) return new Response("Not found or link expired", { status: 404 });
  return new Response(playlist, {
    headers: { "content-type": "application/vnd.apple.mpegurl", "cache-control": "private, max-age=300" },
  });
}
