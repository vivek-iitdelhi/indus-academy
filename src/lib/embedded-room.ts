/**
 * Whether the browser blocks an embedded site's cookies, so the webinar.gg room can't keep its
 * session inside our iframe: Safari, and the browsers on iPhone and iPad other than Chrome.
 * `maxTouchPoints` tells iPadOS (which reports itself as a Mac) from a real Mac.
 */
export function blocksEmbeddedRoom(userAgent: string, maxTouchPoints = 0): boolean {
  // Chrome on iPhone/iPad (CriOS) gets to try the room: it's where the "Open in Chrome" button sends people.
  const ios = isAppleMobile(userAgent, maxTouchPoints) && !/CriOS\//.test(userAgent);
  const safari = /Safari\//.test(userAgent) && !/Chrome\/|CriOS\/|Chromium\/|Edg\/|OPR\/|Firefox\/|Android/.test(userAgent);
  return ios || safari;
}

/** iPhone, iPad or iPod, where every browser (Chrome too) is Safari underneath. */
export const isAppleMobile = (userAgent: string, maxTouchPoints = 0) =>
  /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
