// One-off: encrypts videos encoded before segment encryption (src/lib/hls-crypto.ts).
// Per video: writes enc.key, uploads encrypted copies of each rung's segments as e_<name>,
// switches the rung's playlist to them (with the key tag), then deletes the plain segments.
// Players keep working throughout: a playlist only ever names segments that exist. Safe to
// re-run; videos whose playlists already carry the key tag are skipped.
//
//   node --env-file=.env.encoder scripts/encrypt-videos.ts [--dry-run] [--only <uid>]
import { encryptPlaylist, encryptSegment, KEY_FILE, newVideoKey } from "../src/lib/hls-crypto.ts";
import { r2Fetch } from "../src/lib/video.ts";

const dryRun = process.argv.includes("--dry-run");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;

async function ok(res: Response, what: string) {
  if (!res.ok) throw new Error(`${what}: R2 responded ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res;
}
const get = async (key: string) => Buffer.from(await (await ok(await r2Fetch("GET", key, { timeoutMs: 120_000 }), `GET ${key}`)).arrayBuffer());
const put = async (key: string, body: Buffer | string) => {
  if (!dryRun) await ok(await r2Fetch("PUT", key, { body: new Uint8Array(Buffer.from(body)), timeoutMs: 120_000 }), `PUT ${key}`);
};
const remove = async (key: string) => {
  if (!dryRun) await ok(await r2Fetch("DELETE", key), `DELETE ${key}`);
};

async function list(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const query: Record<string, string> = { "list-type": "2", prefix, ...(token && { "continuation-token": token }) };
    const xml = await (await ok(await r2Fetch("GET", "", { query }), `list ${prefix}`)).text();
    keys.push(...[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]));
    token = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1];
  } while (token);
  return keys;
}

async function encryptVideo(uid: string, keys: string[]) {
  const playlists = keys.filter((k) => /^videos\/[^/]+\/\d+\/index\.m3u8$/.test(k));
  if (!keys.includes(`videos/${uid}/meta.json`) || playlists.length === 0) return console.log(uid, "not ready, skipped");

  const plans = await Promise.all(
    playlists.map(async (key) => ({ key, ...encryptPlaylist((await get(key)).toString("utf8"), (name) => `e_${name}`) })),
  );
  if (plans.every((p) => p.segments.length === 0)) return console.log(uid, "already encrypted");

  // Reuse an existing key if a previous run stopped half-way, so finished rungs stay valid.
  const key = keys.includes(`videos/${uid}/${KEY_FILE}`) ? await get(`videos/${uid}/${KEY_FILE}`) : newVideoKey();
  await put(`videos/${uid}/${KEY_FILE}`, key);
  for (const plan of plans) {
    if (plan.segments.length === 0) continue;
    const dir = plan.key.slice(0, plan.key.lastIndexOf("/") + 1);
    for (const seg of plan.segments) await put(dir + seg.to, encryptSegment(await get(dir + seg.from), key, seg.sequence));
    await put(plan.key, plan.text); // the switch: from here on players fetch e_ segments and the key
    for (const seg of plan.segments) await remove(dir + seg.from);
    console.log(uid, `${dir.split("/").at(-2)}: ${plan.segments.length} segments encrypted`);
  }
}

const all = await list("videos/");
const uids = [...new Set(all.map((k) => k.split("/")[1]).filter(Boolean))].filter((uid) => !only || uid === only);
console.log(`${uids.length} videos${dryRun ? " (dry run: nothing is written)" : ""}`);
for (const uid of uids) await encryptVideo(uid, all.filter((k) => k.startsWith(`videos/${uid}/`)));
console.log("done");
