import { hlsManifestUrl, keyProof, thumbnailUrl, verifyPlaybackToken } from "@/lib/video";

// The partner player: a bare page partners put in an <iframe> (embed_url from the v1 playback
// endpoint). It is a route handler, not a page, so it renders without the site's header/footer.
// Playback happens on our origin, which holds the key proof; partners never see a raw
// playlist they could feed to a download tool.

const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

const page = (body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Indus AI Academy</title><style>html,body{margin:0;height:100%;background:#000;color:#f5f3ec;font:15px system-ui,sans-serif}video{display:block;width:100%;height:100%}.msg{position:fixed;inset:0;display:grid;place-items:center;padding:24px;text-align:center}</style></head><body>${body}</body></html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
        "referrer-policy": "same-origin",
        "x-robots-tag": "noindex",
      },
    },
  );

export async function GET(request: Request, ctx: RouteContext<"/embed/[uid]">) {
  const { uid } = await ctx.params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const exp = verifyPlaybackToken(uid, token);
  if (!exp) return page(`<p class="msg">This video link has expired. Reload the page to get a new one.</p>`, 410);

  const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 60);
  return page(`<video id="v" controls controlslist="nodownload noremoteplayback" disablepictureinpicture playsinline poster="${thumbnailUrl(uid, ttl).replace(/"/g, "&quot;")}"></video>
<p id="err" class="msg" hidden></p>
<script src="/embed/hls.js"></script>
<script>
(function () {
  var src = ${json(hlsManifestUrl(uid, token))}, proof = ${json(keyProof(token))};
  var video = document.getElementById("v"), err = document.getElementById("err");
  function fail(text) { err.textContent = text; err.hidden = false; video.hidden = true; }
  video.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  if (!window.Hls || !Hls.isSupported()) return fail("This browser can't play protected video. Update it (iPhone: iOS 17.1 or later) and try again.");
  video.disableRemotePlayback = true;
  var hls = new Hls({
    capLevelToPlayerSize: true,
    xhrSetup: function (xhr, url) { if (/\\/api\\/video\\/[^/]+\\/key\\?/.test(url)) xhr.setRequestHeader("x-iaa-key-proof", proof); }
  });
  hls.on(Hls.Events.ERROR, function (_e, data) { if (data.fatal) fail("The video stopped loading. Reload the page to try again."); });
  hls.loadSource(src);
  hls.attachMedia(video);
})();
</script>`);
}
