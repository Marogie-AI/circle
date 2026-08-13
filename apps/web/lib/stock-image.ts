/**
 * Stock cover images from Openverse, for posts that have no picture of their own.
 *
 * Openverse (openverse.org, run by the WordPress Foundation) aggregates openly-licensed
 * images. Chosen over Unsplash and Pexels because it needs no API key: the feature works
 * on a fresh checkout instead of sitting dormant until someone registers an application.
 * An optional token raises the rate limit; absence of one is not an error.
 *
 * PRIVACY: this sends words derived from a post to Openverse, and their servers log the
 * query. These are private groups, so `stockKeywords` deliberately sends as little as it
 * can — a couple of tags or title words, never the body, never the group name, never
 * anything naming a member. Read it before widening what goes out.
 *
 * LICENSING: this asks for public-domain images only (cc0 and pdm). That is a deliberate
 * trade — a smaller pool, in exchange for covers that carry no attribution requirement
 * and so need no credit overlay burned into every card. The creator and licence are still
 * captured and stored, because knowing where an image came from is worth having even when
 * nothing obliges us to show it.
 *
 * If this is ever widened to CC-BY or CC-BY-SA, the visible credit MUST come back: those
 * licences require naming the creator and the licence wherever the image is displayed.
 */

const API = "https://api.openverse.org/v1/images/";
const TIMEOUT_MS = 4000;

export type StockImage = {
  url: string;
  authorName: string;
  /** The image's page on its source site, which is where credit should point. */
  authorUrl: string;
  licenseName: string;
  licenseUrl: string;
};

/**
 * Always on. Unlike a key-gated provider there is nothing to configure, so this exists
 * only so callers read the same way as before and a kill switch has somewhere to live.
 */
export function stockImagesEnabled() {
  return process.env.STOCK_IMAGES_DISABLED !== "1";
}

/**
 * Words that are worth sending. Two rules, both about sending less:
 *
 * 1. Tags win. They are already a short, normalised, deliberately shared vocabulary
 *    ("engineering", "books"), so they leak far less than prose a member wrote.
 * 2. Only with no tags do we fall back to the title, stripped of stopwords and capped at
 *    three words — enough for a relevant photo, not a sentence.
 */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "at", "by", "from", "up", "about", "into", "over", "after", "is", "are",
  "was", "were", "be", "been", "it", "its", "this", "that", "these", "those",
  "how", "why", "what", "when", "just", "very", "really", "actually", "my",
  "your", "our", "their", "i", "you", "we", "they", "not", "no", "do", "does",
]);

export function stockKeywords(
  title: string | null | undefined,
  tags: readonly string[] = [],
): string | null {
  const fromTags = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => /^[a-z0-9-]{2,24}$/.test(tag))
    .slice(0, 2);
  if (fromTags.length) return fromTags.join(" ");

  const words = (title ?? "")
    .toLowerCase()
    // Letters and spaces only: digits, punctuation and any pasted identifier go.
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .slice(0, 3);

  return words.length ? words.join(" ") : null;
}

type OpenverseResult = {
  url?: string;
  thumbnail?: string;
  creator?: string;
  foreign_landing_url?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
};

/** "CC BY-SA 4.0" from Openverse's separate license and version fields. */
function licenseLabel(license: string, version?: string) {
  const name = license.toUpperCase();
  // Public-domain marks are not "CC" prefixed.
  const prefixed = name === "CC0" || name === "PDM" ? name : `CC ${name}`;
  return version ? `${prefixed} ${version}` : prefixed;
}

/**
 * One wide image for a query, or null.
 *
 * Never throws: a cover is decoration. A rate limit, a timeout, a shape we do not
 * recognise, or a result we cannot legally credit all mean "no cover", never a failed
 * post.
 */
export async function fetchStockImage(
  query: string,
): Promise<StockImage | null> {
  if (!stockImagesEnabled() || !query.trim()) return null;

  const direct = await search(query);
  if (direct) return direct;

  // Narrow queries fail in two ways, and both are worth one retry:
  //  - "engineering career" AND-s to zero results, though "engineering" has plenty
  //  - a niche phrase matches only images we cannot credit
  // Retry with the first term alone. One retry, so a miss still costs at most two calls.
  const [first] = query.trim().split(/\s+/);
  if (first && first !== query.trim()) return search(first);

  return null;
}

/**
 * One Openverse result, or null if we may not display it.
 *
 * Everything here is a condition of use, not a preference: CC-BY and CC-BY-SA require the
 * creator and the licence to be shown, and the CSP (img-src 'self' data: https:) drops a
 * non-https image, which would render a blank card.
 */
function toStockImage(hit: OpenverseResult): StockImage | null {
  const image = hit.url ?? hit.thumbnail;
  const authorName = hit.creator;
  const authorUrl = hit.foreign_landing_url;
  const license = hit.license;
  const licenseUrl = hit.license_url;

  if (!image || !authorName || !authorUrl || !license || !licenseUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(image);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  return {
    url: parsed.toString(),
    authorName,
    authorUrl,
    licenseName: licenseLabel(license, hit.license_version),
    licenseUrl,
  };
}

async function search(query: string): Promise<StockImage | null> {
  const url = new URL(API);
  url.searchParams.set("q", query);
  // Ask for several, not one. Results missing a creator are common and unusable to us,
  // so requesting a single row meant one uncreditable hit looked like "no image exists"
  // when there were hundreds of usable ones behind it.
  url.searchParams.set("page_size", "8");
  url.searchParams.set("aspect_ratio", "wide");
  url.searchParams.set("size", "medium");
  // PUBLIC DOMAIN ONLY — cc0 and pdm. This is what lets the cards show a cover with no
  // credit overlay on them: CC-BY and CC-BY-SA would require naming the creator and the
  // licence wherever the image appears, and a cover is too small to carry that without
  // becoming the loudest thing on the card. Widening this back to `license_type=
  // commercial,modification` means the attribution must come back with it.
  url.searchParams.set("license", "cc0,pdm");
  // Openverse's own safety filter; mature content is excluded by default but be explicit.
  url.searchParams.set("mature", "false");

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  // Optional: raises the anonymous rate limit. Never required.
  if (process.env.OPENVERSE_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.OPENVERSE_API_TOKEN}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) return null;

    const body = (await response.json()) as { results?: OpenverseResult[] };

    // Walk the page and take the first result we can actually use. Skipping rather than
    // giving up is the point: an uncreditable first hit used to read as "no image
    // exists", even with hundreds of usable ones behind it.
    for (const hit of body.results ?? []) {
      const usable = toStockImage(hit);
      if (usable) return usable;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
