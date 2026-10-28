import { hlsManifestUrl, keyProof, thumbnailUrl, verifyPlaybackToken } from "@/lib/video";
import { MESSAGES, parseEmbedOptions, secondsLeft, type Lang } from "../player";

// The partner player: a bare page partners put in an <iframe> (embed_url from the v1 playback
// endpoint). It is a route handler, not a page, so it renders without the site's header/footer.
// Playback happens on our origin, which holds the key proof; partners never see a raw
// playlist they could feed to a download tool.
// It tells the partner page what happens through postMessage events, {source:"indus-player",
// type, uid, …}: ready, progress, ended, expired and error (documented in distributor-api.md).
// They carry positions only, nothing secret, so they go to any parent ("*").

const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

const page = (body: string, lang: Lang, status = 200) =>
  new Response(
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Indus AI Academy</title><style>html,body{margin:0;height:100%;background:#000;color:#f5f3ec;font:15px system-ui,sans-serif}video{display:block;width:100%;height:100%}.msg{position:fixed;inset:0;display:grid;place-items:center;padding:24px;text-align:center}#q{position:fixed;top:8px;right:8px;font:13px system-ui,sans-serif;color:#f5f3ec;background:#000b;border:1px solid #fff6;border-radius:4px;padding:4px}.playing #q{display:none}[hidden]{display:none!important}</style></head><body>${body}</body></html>`,
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
  const params = new URL(request.url).searchParams;
  const token = params.get("t") ?? "";
  const { lang, start, maxHeight } = parseEmbedOptions(params);
  const t = MESSAGES[lang];
  const exp = verifyPlaybackToken(uid, token);
  if (!exp) {
    return page(
      `<p class="msg">${t.expired}</p><script>parent.postMessage({source:"indus-player",type:"expired",uid:${json(uid)}},"*")</script>`,
      lang,
      410,
    );
  }

  const left = secondsLeft(exp);
  return page(`<video id="v" controls controlslist="nodownload noremoteplayback" disablepictureinpicture playsinline poster="${thumbnailUrl(uid, Math.max(left, 60)).replace(/"/g, "&quot;")}"></video>
<select id="q" hidden></select>
<p id="err" class="msg" hidden></p>
<script src="/embed/hls.js"></script>
<script>
(function () {
  var uid = ${json(uid)}, src = ${json(hlsManifestUrl(uid, token))}, proof = ${json(keyProof(token))};
  var t = ${json(t)}, start = ${start}, maxHeight = ${json(maxHeight)}, left = ${left};
  var video = document.getElementById("v"), err = document.getElementById("err"), menu = document.getElementById("q");
  var hls, done = false, ready = false, lastProgress = 0, mediaRetried = false;
  // Counted from load, not the device clock (often wrong on cheap phones).
  var deadline = performance.now() + left * 1000;
  function send(type, data) {
    var msg = { source: "indus-player", type: type, uid: uid };
    for (var k in data) msg[k] = data[k];
    parent.postMessage(msg, "*");
  }
  function seconds() { return Math.floor(video.currentTime); }
  function duration() { return Math.round(video.duration) || 0; }
  function fail(text, code) {
    if (done) return;
    done = true;
    send("error", { code: code });
    err.textContent = text; err.hidden = false; video.hidden = true; menu.hidden = true;
  }
  // The token's segments and key stop working now; tell the parent where the learner was so
  // it can load a fresh embed_url with start=<seconds>.
  function expire() {
    if (done) return;
    done = true;
    send("expired", { seconds: seconds() });
    if (hls) hls.destroy();
    err.textContent = t.expired; err.hidden = false; video.hidden = true; menu.hidden = true;
  }
  function progress() {
    if (done || !ready) return;
    lastProgress = Date.now();
    send("progress", { seconds: seconds(), duration: duration() });
  }
  video.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  if (!window.Hls || !Hls.isSupported()) return fail(t.unsupported, "unsupported");
  setTimeout(expire, left * 1000);
  video.disableRemotePlayback = true;
  video.addEventListener("loadedmetadata", function () {
    if (ready) return;
    ready = true;
    if (start >= video.duration) video.currentTime = 0;
    send("ready", { duration: duration() });
  });
  video.addEventListener("timeupdate", function () { if (!video.paused && Date.now() - lastProgress >= 10000) progress(); });
  video.addEventListener("pause", progress);
  video.addEventListener("seeked", progress);
  video.addEventListener("ended", function () { if (!done) send("ended", {}); });
  video.addEventListener("play", function () { document.body.className = "playing"; });
  video.addEventListener("pause", function () { document.body.className = ""; });
  hls = new Hls({
    autoStartLoad: false,
    capLevelToPlayerSize: true,
    xhrSetup: function (xhr, url) { if (/\\/api\\/video\\/[^/]+\\/key\\?/.test(url)) xhr.setRequestHeader("x-iaa-key-proof", proof); }
  });
  hls.on(Hls.Events.MANIFEST_PARSED, function () {
    // max_height: drop the renditions above it, by the frame's short side (so 360 = 360p in
    // portrait too). Levels are sorted smallest first and the smallest always stays.
    function size(level) { return level.width && level.height ? Math.min(level.width, level.height) : 0; }
    if (maxHeight) for (var i = hls.levels.length - 1; i > 0; i--) if (size(hls.levels[i]) > maxHeight) hls.removeLevel(i);
    if (hls.levels.length > 1) {
      menu.setAttribute("aria-label", t.quality);
      menu.add(new Option(t.quality + ": " + t.auto, "-1"));
      for (var j = hls.levels.length - 1; j >= 0; j--) {
        var s = size(hls.levels[j]);
        menu.add(new Option(s ? s + "p" : Math.round(hls.levels[j].bitrate / 1000) + " kbps", String(j)));
      }
      menu.onchange = function () { hls.nextLevel = Number(menu.value); };
      menu.hidden = false;
    }
    hls.startLoad(start || -1);
  });
  hls.on(Hls.Events.ERROR, function (_e, data) {
    if (!data.fatal || done) return;
    var status = data.response && data.response.code;
    // Past the deadline, or refused mid-playback (the timer can lag after the phone slept).
    if (performance.now() >= deadline || (ready && (status === 403 || status === 404))) return expire();
    if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRetried) { mediaRetried = true; return hls.recoverMediaError(); }
    fail(t.stopped, data.type === Hls.ErrorTypes.NETWORK_ERROR ? "network" : data.type === Hls.ErrorTypes.MEDIA_ERROR ? "media" : "other");
  });
  hls.loadSource(src);
  hls.attachMedia(video);
})();
</script>`, lang);
}
