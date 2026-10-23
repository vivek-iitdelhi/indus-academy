import assert from "node:assert/strict";
import { createDecipheriv } from "node:crypto";
import { test } from "node:test";
import { encryptPlaylist, encryptSegment, ivFor, newVideoKey } from "./hls-crypto.ts";

const media = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-INDEPENDENT-SEGMENTS
#EXTINF:6.000000,
seg_0000.ts
#EXTINF:4.500000,
seg_0001.ts
#EXT-X-ENDLIST
`;

test("ivFor: the media sequence number as a big-endian 128-bit integer", () => {
  assert.equal(ivFor(0).toString("hex"), "0".repeat(32));
  assert.equal(ivFor(258).toString("hex"), "0".repeat(28) + "0102");
});

test("encryptSegment: AES-128-CBC with PKCS7 padding, decryptable with the sequence IV", () => {
  const key = newVideoKey();
  const data = Buffer.from("not a real transport stream, but bytes all the same");
  const encrypted = encryptSegment(data, key, 7);
  assert.notDeepEqual(encrypted, data);
  assert.equal(encrypted.length % 16, 0);
  const decipher = createDecipheriv("aes-128-cbc", key, ivFor(7));
  assert.deepEqual(Buffer.concat([decipher.update(encrypted), decipher.final()]), data);
});

test("encryptPlaylist: key tag before the first segment, renamed segments with their sequence", () => {
  const { text, segments } = encryptPlaylist(media, (name) => `e_${name}`);
  assert.deepEqual(segments, [
    { from: "seg_0000.ts", to: "e_seg_0000.ts", sequence: 0 },
    { from: "seg_0001.ts", to: "e_seg_0001.ts", sequence: 1 },
  ]);
  const lines = text.split("\n");
  assert.equal(lines.indexOf('#EXT-X-KEY:METHOD=AES-128,URI="key"'), lines.indexOf("#EXTINF:6.000000,") - 1);
  assert.ok(text.includes("e_seg_0001.ts") && !text.includes("\nseg_0000.ts"));
  assert.ok(text.endsWith("#EXT-X-ENDLIST\n"));
});

test("encryptPlaylist: honours MEDIA-SEQUENCE and leaves encrypted playlists alone", () => {
  const { segments } = encryptPlaylist(media.replace("MEDIA-SEQUENCE:0", "MEDIA-SEQUENCE:5"));
  assert.deepEqual(segments.map((s) => s.sequence), [5, 6]);
  const once = encryptPlaylist(media).text;
  assert.deepEqual(encryptPlaylist(once), { text: once, segments: [] });
});
