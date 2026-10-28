import assert from "node:assert/strict";
import { test } from "node:test";
import { addVariants, ffmpegArgs, rungsFor, variantsOf } from "../../scripts/encoder.ts";
import { decryptSegment, encryptSegment, newVideoKey } from "./hls-crypto.ts";
import { rewritePlaylist } from "./video.ts";

// Masters as ffmpeg writes them: before the low rungs, and the backfill's two new variants.
const oldMaster = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-STREAM-INF:BANDWIDTH=368480,AVERAGE-BANDWIDTH=357312,RESOLUTION=426x240,CODECS="avc1.4d4015,mp4a.40.2"
0/index.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=932480,AVERAGE-BANDWIDTH=916312,RESOLUTION=854x480,CODECS="avc1.4d401f,mp4a.40.2"
1/index.m3u8

`;
const lowMaster = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-STREAM-INF:BANDWIDTH=159925,AVERAGE-BANDWIDTH=157055,RESOLUTION=256x144,CODECS="avc1.4d400b,mp4a.40.2"
2/index.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=55206,AVERAGE-BANDWIDTH=54762,CODECS="mp4a.40.2"
3/index.m3u8
`;

test("rungs: 144p comes after the ladder, so players don't start on it", () => {
  assert.deepEqual(rungsFor(1080).map((r) => r.size), [240, 360, 480, 720, 1080, 144]);
  assert.deepEqual(rungsFor(200).map((r) => r.size), [200, 144]); // small source: its own size, then 144p
  assert.deepEqual(rungsFor(120).map((r) => r.size), [120]);
  const [low] = rungsFor(1080).slice(-1);
  assert.deepEqual([low.kbps, low.audio, low.fps], [85, { kbps: 48, channels: 1 }, 15]);
});

test("ffmpeg args: the audio-only rendition follows the video rungs, numbered from `first`", () => {
  const map = (args: string[]) => args[args.indexOf("-var_stream_map") + 1];
  assert.equal(map(ffmpegArgs("in", "out", { rungs: rungsFor(360), hasAudio: true })), "v:0,a:0,name:0 v:1,a:1,name:1 v:2,a:2,name:2 a:3,name:3");
  assert.equal(map(ffmpegArgs("in", "out", { rungs: rungsFor(200).slice(1), hasAudio: true, first: 4 })), "v:0,a:0,name:4 a:1,name:5");
  assert.equal(map(ffmpegArgs("in", "out", { rungs: rungsFor(360), hasAudio: false })), "v:0,name:0 v:1,name:1 v:2,name:2");
  const args = ffmpegArgs("in", "out", { rungs: rungsFor(360), hasAudio: true });
  assert.deepEqual(args.slice(args.indexOf("-b:a:2"), args.indexOf("-b:a:2") + 8), ["-b:a:2", "48k", "-ac:a:2", "1", "-b:a:3", "48k", "-ac:a:3", "1"]);
});

test("backfill: new variants go after the old ones, and the result still rewrites", () => {
  const merged = addVariants(oldMaster, lowMaster);
  assert.deepEqual(variantsOf(merged), [
    { uri: "0/index.m3u8", bandwidth: 368480, shortSide: 240 },
    { uri: "1/index.m3u8", bandwidth: 932480, shortSide: 480 },
    { uri: "2/index.m3u8", bandwidth: 159925, shortSide: 144 },
    { uri: "3/index.m3u8", bandwidth: 55206, shortSide: 0 },
  ]);
  assert.equal(merged.match(/#EXTM3U/g)?.length, 1);
  const rewritten = rewritePlaylist(merged, { uid: "u", file: "master.m3u8", token: "T", sign: (k) => `signed:${k}` });
  assert.match(rewritten, /^3\/index\.m3u8\?t=T$/m);
});

test("decryptSegment undoes encryptSegment", () => {
  const key = newVideoKey();
  const data = Buffer.from("a segment, not a multiple of sixteen bytes");
  assert.deepEqual(decryptSegment(encryptSegment(data, key, 7), key, 7), data);
});
