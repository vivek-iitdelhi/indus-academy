// Pure helpers for the partner player (/embed/[uid]): its optional URL parameters and the
// words it shows. Kept apart from the route so they can be tested without storage or a secret.

export type Lang = "en" | "hi";

/** Every string the player shows, per language. Add a language by adding a column here. */
export const MESSAGES = {
  en: {
    expired: "This video link has expired. Go back and open the lesson again to keep watching.",
    unsupported: "This browser can't play protected video. Update it (iPhone: iOS 17.1 or later) and try again.",
    stopped: "The video stopped loading. Reload the page to try again.",
    quality: "Quality",
    auto: "Auto",
  },
  hi: {
    expired: "इस वीडियो लिंक की समय-सीमा समाप्त हो गई है। आगे देखने के लिए वापस जाएँ और यह पाठ फिर से खोलें।",
    unsupported: "यह ब्राउज़र सुरक्षित वीडियो नहीं चला सकता। इसे अपडेट करें (iPhone: iOS 17.1 या नया) और फिर से कोशिश करें।",
    stopped: "वीडियो लोड होना रुक गया। फिर से कोशिश करने के लिए पेज दोबारा लोड करें।",
    quality: "क्वालिटी",
    auto: "ऑटो",
  },
} satisfies Record<Lang, Record<string, string>>;

const MAX_START_SECONDS = 24 * 60 * 60;
const MAX_HEIGHT = 4320;

export type EmbedOptions = { lang: Lang; start: number; maxHeight: number | null };

/**
 * The optional parameters partners append to embed_url. Invalid values are ignored rather than
 * refused, so a bad `start` never stops a learner from watching:
 *   lang=hi|en          language of the player's messages (default en)
 *   start=<seconds>     where to begin, e.g. the position from the last `progress` event
 *   max_height=<n>      highest rendition to load, by the frame's short side (360 = 360p)
 */
export function parseEmbedOptions(params: URLSearchParams): EmbedOptions {
  const start = Number(params.get("start"));
  const maxHeight = Number(params.get("max_height"));
  return {
    lang: params.get("lang") === "hi" ? "hi" : "en",
    start: Number.isFinite(start) && start > 0 && start <= MAX_START_SECONDS ? Math.floor(start) : 0,
    maxHeight: Number.isInteger(maxHeight) && maxHeight > 0 && maxHeight <= MAX_HEIGHT ? maxHeight : null,
  };
}

/**
 * Seconds of validity a token expiring at `exp` (unix seconds) has left. The page counts this
 * down from load, not against the device clock, which is often wrong on cheap phones.
 */
export const secondsLeft = (exp: number, nowMs = Date.now()) => Math.max(exp - Math.floor(nowMs / 1000), 0);
