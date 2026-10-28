/**
 * Whether the browser blocks an embedded site's cookies, so the webinar.gg room can't keep its
 * session inside our iframe: Safari, and every browser on iPhone and iPad (all WebKit).
 * `maxTouchPoints` tells iPadOS (which reports itself as a Mac) from a real Mac.
 */
export function blocksEmbeddedRoom(userAgent: string, maxTouchPoints = 0): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  const safari = /Safari\//.test(userAgent) && !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\/|Android/.test(userAgent);
  return ios || safari;
}
