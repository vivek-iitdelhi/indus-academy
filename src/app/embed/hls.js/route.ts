import { readFile } from "node:fs/promises";
import path from "node:path";

// hls.js for the partner player (/embed/[uid]), served from our own origin rather than a CDN.
// Shipped with the server build through outputFileTracingIncludes in next.config.ts.
const FILE = path.join(process.cwd(), "node_modules/hls.js/dist/hls.min.js");

export async function GET() {
  return new Response(await readFile(FILE), {
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
}
