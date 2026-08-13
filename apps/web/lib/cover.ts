/**
 * Generated covers for posts with no image of their own.
 *
 * A note or a plain-text article has nothing to show, and an empty 16:9 box with one tiny
 * glyph in it was most of each card. Rather than invent a picture, the cover is built from
 * the post itself: a deterministic wash plus the opening words.
 *
 * Deliberately no colour. The palette is zero-chroma throughout (see globals.css), so
 * tinted covers would be the only saturated thing in the product.
 */

/**
 * FNV-1a. Small, stable, and — unlike a random pick — gives the same post the same cover
 * on every render, so the feed does not reshuffle its own artwork on refresh.
 */
export function hashSeed(value: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Four washes, each a plain Tailwind gradient over existing theme tokens so they follow
 * light and dark mode without a second set of values.
 */
const WASHES = [
  "bg-gradient-to-br from-rail via-surface to-hover",
  "bg-gradient-to-tr from-hover via-rail to-surface",
  "bg-gradient-to-b from-surface via-hover to-rail",
  "bg-gradient-to-bl from-rail via-hover to-surface",
] as const;

export function coverWash(seed: string) {
  return WASHES[hashSeed(seed) % WASHES.length];
}

/**
 * The opening of the body, trimmed to a whole word and stripped of the markdown that
 * would otherwise show up as literal `##` and `**` in the cover.
 */
export function coverExcerpt(
  body: string | null | undefined,
  limit = 110,
): string | null {
  if (!body) return null;

  const plain = body
    // fenced code, images and links first — their innards should not survive as text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^>\s?/gm, " ")
    .replace(/^#{1,6}\s+/gm, " ")
    .replace(/^\s*[-*+]\s+/gm, " ")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return null;
  if (plain.length <= limit) return plain;

  const cut = plain.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  // Break on a word unless the first "word" is longer than the whole budget.
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
