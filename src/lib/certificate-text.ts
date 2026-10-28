/** How the certificate image sets the holder's name (up to 120 characters, any script). */

/** Noto Serif family per Indic script (Unicode script names), in lookup order. */
const indicFonts = [
  ["Devanagari", "Noto Serif Devanagari"], // Hindi, Marathi, Nepali
  ["Bengali", "Noto Serif Bengali"], // and Assamese
  ["Gujarati", "Noto Serif Gujarati"],
  ["Gurmukhi", "Noto Serif Gurmukhi"],
  ["Oriya", "Noto Serif Oriya"], // Odia
  ["Tamil", "Noto Serif Tamil"],
  ["Telugu", "Noto Serif Telugu"],
  ["Kannada", "Noto Serif Kannada"],
  ["Malayalam", "Noto Serif Malayalam"],
].map(([script, family]) => ({ script: new RegExp(`\\p{Script=${script}}`, "u"), family }));

/**
 * The Noto family for the Indic script the name uses, or null if it uses none. Only one:
 * a name mixing two Indic scripts gets the first's font (its Latin is covered too).
 */
export function indicFont(name: string): string | null {
  return indicFonts.find(({ script }) => script.test(name))?.family ?? null;
}

/** Widest the name may set, in px: the certificate's text column less a margin. */
export const NAME_BOX = 1260;
const MAX = 124;
const FLOOR = 72;

/** A Latin name's width in ems in Instrument Serif italic, erring wide (measured ~0.43 a letter). */
export function latinEms(name: string): number {
  let ems = 0;
  for (const ch of name) ems += ch === " " ? 0.2 : /\p{Lu}/u.test(ch) ? 0.55 : /\p{Ll}/u.test(ch) ? 0.45 : 0.5;
  return ems;
}

/**
 * Font size for a name `ems` wide on one line: the largest that fits NAME_BOX, up to MAX
 * and down to FLOOR. Below that it wraps to two lines at FLOOR, shrinking further only if
 * two lines still overflow.
 */
export function nameFontSize(ems: number): { fontSize: number; lines: 1 | 2 } {
  const oneLine = Math.min(MAX, Math.floor(NAME_BOX / ems));
  if (oneLine >= FLOOR) return { fontSize: oneLine, lines: 1 };
  // Breaking at spaces leaves the first line short, so fill only 85% of the two.
  return { fontSize: Math.min(FLOOR, Math.floor((2 * NAME_BOX * 0.85) / ems)), lines: 2 };
}
