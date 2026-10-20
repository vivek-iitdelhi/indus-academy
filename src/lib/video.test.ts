import assert from "node:assert/strict";
import { test } from "node:test";
import { hlsManifestUrl, rewritePlaylist, signPlaybackToken, signS3, verifyPlaybackToken } from "./video.ts";

test("presigns a URL matching AWS's published SigV4 example", () => {
  // docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
  const { url } = signS3(
    {
      endpoint: "https://examplebucket.s3.amazonaws.com",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    },
    "GET",
    "test.txt",
    { expiresIn: 86400, now: new Date("2013-05-24T00:00:00Z") },
  );
  assert.equal(
    new URL(url).searchParams.get("X-Amz-Signature"),
    "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
  );
});

test("playback tokens are bound to one video and expire", () => {
  process.env.VIDEO_TOKEN_SECRET = "test-secret";
  const token = signPlaybackToken("video-a", 3600);
  const exp = verifyPlaybackToken("video-a", token);
  assert.ok(exp && Math.abs(exp - (Date.now() / 1000 + 3600)) < 5);
  assert.equal(verifyPlaybackToken("video-b", token), null, "other video");
  assert.equal(verifyPlaybackToken("video-a", `${exp! + 1}.${token.split(".")[1]}`), null, "edited expiry");
  assert.equal(verifyPlaybackToken("video-a", "garbage"), null);
  // TTL is capped at 24 h; an expired token is refused.
  const long = verifyPlaybackToken("video-a", signPlaybackToken("video-a", 7 * 86400))!;
  assert.ok(long <= Date.now() / 1000 + 86400 + 1);
  const past = Math.floor(Date.now() / 1000) - 10;
  assert.equal(verifyPlaybackToken("video-a", `${past}.${token.split(".")[1]}`), null);
  assert.equal(hlsManifestUrl("video-a", "1.x"), "/api/video/video-a/master.m3u8?t=1.x");
});

test("rewrites playlists: playlists keep the token, segments get signed URLs", () => {
  const sign = (key: string) => `https://r2/${key}?sig`;
  const master = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=300000\n0/index.m3u8\n#EXT-X-MEDIA:TYPE=AUDIO,URI=\"2/index.m3u8\"\n";
  assert.equal(
    rewritePlaylist(master, { uid: "u", file: "master.m3u8", token: "T", sign }),
    "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=300000\n0/index.m3u8?t=T\n#EXT-X-MEDIA:TYPE=AUDIO,URI=\"2/index.m3u8?t=T\"\n",
  );
  const media = "#EXTM3U\n#EXTINF:6.0,\nseg_0000.ts\n#EXT-X-ENDLIST";
  assert.equal(
    rewritePlaylist(media, { uid: "u", file: "0/index.m3u8", token: "T", sign }),
    "#EXTM3U\n#EXTINF:6.0,\nhttps://r2/videos/u/0/seg_0000.ts?sig\n#EXT-X-ENDLIST",
  );
  assert.throws(() => rewritePlaylist("../../secret.ts", { uid: "u", file: "master.m3u8", token: "T", sign }));
  assert.throws(() => rewritePlaylist("https://evil/x.ts", { uid: "u", file: "master.m3u8", token: "T", sign }));
});
