import { createCipheriv, randomBytes } from "node:crypto";

// AES-128 HLS encryption (RFC 8216 §4.3.2.4): segments are stored encrypted and the key is
// served only to our player (see videoKeyFor in video.ts), so downloaded segments are useless.

/** Stored next to the segments at videos/<uid>/; never presigned or referenced by playlists. */
export const KEY_FILE = "enc.key";
/** Placeholder URI in stored playlists; rewritePlaylist points it at the key endpoint. */
export const KEY_URI_PLACEHOLDER = "key";

export const newVideoKey = () => randomBytes(16);

/** The implicit IV of a segment: its media sequence number as a 128-bit big-endian integer. */
export function ivFor(sequence: number): Buffer {
  const iv = Buffer.alloc(16);
  iv.writeBigUInt64BE(BigInt(sequence), 8);
  return iv;
}

export function encryptSegment(data: Buffer, key: Buffer, sequence: number): Buffer {
  const cipher = createCipheriv("aes-128-cbc", key, ivFor(sequence));
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

export type SegmentPlan = { from: string; to: string; sequence: number };

/**
 * A media playlist rewritten for encrypted segments: adds the key tag before the first
 * segment and renames each segment with `rename`. Returns the new text and, per segment, its
 * old name, new name and media sequence number (the IV to encrypt it with). Already encrypted
 * playlists come back unchanged with no segments.
 */
export function encryptPlaylist(text: string, rename: (name: string) => string = (name) => name) {
  if (text.includes("#EXT-X-KEY")) return { text, segments: [] as SegmentPlan[] };
  const first = Number(/^#EXT-X-MEDIA-SEQUENCE:(\d+)/m.exec(text)?.[1] ?? 0);
  const segments: SegmentPlan[] = [];
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#EXTINF") && segments.length === 0) {
      lines.push(`#EXT-X-KEY:METHOD=AES-128,URI="${KEY_URI_PLACEHOLDER}"`);
    }
    if (line && !line.startsWith("#")) {
      const to = rename(line);
      segments.push({ from: line, to, sequence: first + segments.length });
      lines.push(to);
    } else {
      lines.push(raw);
    }
  }
  return { text: lines.join("\n"), segments };
}
