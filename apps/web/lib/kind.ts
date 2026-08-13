/**
 * What kind of thing a post is. Categories live here rather than in a DB check
 * constraint so adding one is a code change, not a migration.
 *
 * Deliberately dependency-free — imported by client components (the compose form's
 * select, the sidebar quick-add menu) as well as by server actions and queries.
 */
export const POST_KINDS = ["video", "article", "tool", "note"] as const;

export type PostKind = (typeof POST_KINDS)[number];

/** The column default. Anything unclassified is a note. */
export const DEFAULT_POST_KIND: PostKind = "note";

export const KIND_LABELS: Record<PostKind, string> = {
  video: "Video",
  article: "Article",
  tool: "Tool",
  note: "Note",
};

/**
 * Narrow an untrusted value to a kind. Returns null rather than a default so callers
 * can tell "absent" from "invalid" — a `?kind=` in the URL and a FormData field are
 * both attacker-controlled, and `kind` reaches a SQL predicate.
 */
export function parsePostKind(value: unknown): PostKind | null {
  return typeof value === "string" && POST_KINDS.includes(value as PostKind)
    ? (value as PostKind)
    : null;
}

/**
 * The video id from any YouTube URL shape we might be handed: watch?v=, youtu.be/,
 * /shorts/, /embed/, /live/. Null for everything else.
 *
 * Host is matched against an exact allowlist, not a suffix: `endsWith("youtube.com")`
 * would also accept `evil-youtube.com`, and the id feeds straight into an image URL.
 */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const id =
    host === "youtu.be"
      ? parsed.pathname.slice(1)
      : host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com"
        ? parsed.pathname === "/watch"
          ? (parsed.searchParams.get("v") ?? "")
          : (/^\/(?:shorts|embed|live)\/([^/]+)/.exec(parsed.pathname)?.[1] ?? "")
        : "";

  // YouTube ids are 11 chars of the URL-safe base64 alphabet. Validating the shape keeps
  // a crafted link out of the thumbnail URL we build from it.
  return /^[\w-]{11}$/.test(id) ? id : null;
}

/**
 * Thumbnail for a video id.
 *
 * Derived, not fetched: safeFetchPreview would eventually give us the same image as
 * ogImage, but that lands a moment after the post is written and can fail outright. A
 * video card should never render blank while waiting on it.
 *
 * hqdefault always exists (maxresdefault 404s on older or low-res uploads). The fixed
 * i.ytimg.com host is covered by the CSP's `img-src 'self' data: https:`.
 */
export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * The kind a URL suggests, for preselecting the compose form. A guess, always
 * overridable by the author — never used to correct what they explicitly chose.
 */
export function detectKind(url: string | null | undefined): PostKind {
  if (!url?.trim()) return "note";
  return youtubeId(url) ? "video" : "article";
}
