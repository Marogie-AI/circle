import Link from "next/link";
import type { ReactNode } from "react";
import { PlayFilledIcon } from "@/components/icons";
import { KindIcon, KIND_CHIP } from "@/components/kind-icon";
import { coverExcerpt, coverWash } from "@/lib/cover";
import {
  DEFAULT_POST_KIND,
  KIND_LABELS,
  parsePostKind,
  youtubeId,
  youtubeThumb,
} from "@/lib/kind";

export type PostCardPost = {
  id: string;
  title: string;
  tags: string[];
  createdAt: Date;
  authorName: string;
  ogImage?: string | null;
  url?: string | null;
  kind?: string | null;
  /** First 200 chars of the body, for the text cover fallback. */
  excerpt?: string | null;
  /**
   * Stock cover, used when the post has no image of its own. No creator or licence here:
   * covers are fetched public-domain only, so nothing has to be displayed alongside them.
   * The credit IS still stored on the row (see lib/stock-image.ts) — if that filter ever
   * widens to CC-BY, both the query and this type need it back.
   */
  coverUrl?: string | null;
};

/**
 * A find in the group feed.
 *
 * Videos get their thumbnail straight from the YouTube id rather than from the Open
 * Graph fetch, so a freshly posted video is never a blank rectangle while the preview
 * is still in flight (see lib/kind.ts).
 *
 * Images are a plain <img>, deliberately NOT next/image — optimising remote images means
 * opening `remotePatterns` to arbitrary hosts, which turns the server into an open image
 * proxy. Same reasoning as components/link-card.tsx.
 */
export function PostCard({
  post,
  slug,
  isNew = false,
  saveButton,
}: {
  post: PostCardPost;
  slug: string;
  /** Unseen since the member's last visit — drives the same dot the table row had. */
  isNew?: boolean;
  /** Rendered by the page, which owns the server action the toggle calls. */
  saveButton?: ReactNode;
}) {
  const kind = parsePostKind(post.kind) ?? DEFAULT_POST_KIND;
  const videoId = kind === "video" ? youtubeId(post.url) : null;
  // Precedence: the video's own frame, then the linked page's artwork, then a stock cover
  // we fetched. The text cover is the last resort, for a post with no image anywhere.
  const thumbnail =
    (videoId ? youtubeThumb(videoId) : null) ??
    post.ogImage ??
    post.coverUrl ??
    null;
  const excerpt = thumbnail ? null : coverExcerpt(post.excerpt);
  const href = `/groups/${slug}/p/${post.id}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:shadow-md focus-within:shadow-md">
      {/* The media sits in a plain wrapper, not inside the <Link>: the Unsplash credit is
          itself a link, and a link nested in a link is invalid HTML. */}
      <div className="relative">
      <Link
        href={href}
        prefetch
        tabIndex={-1}
        aria-hidden
        className="relative block bg-rail"
      >
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="aspect-video w-full object-cover"
          />
        ) : (
          // No image of its own: build a cover out of the post. A wash keyed to the id so
          // it is stable across renders, plus the opening words — a note or a plain-text
          // article otherwise left most of the card empty. See lib/cover.ts.
          <div
            className={`flex aspect-video w-full flex-col justify-between p-4 ${coverWash(post.id)}`}
          >
            {excerpt ? (
              <p className="line-clamp-3 text-[0.9375rem] font-medium leading-snug text-muted">
                {excerpt}
              </p>
            ) : (
              // Nothing quotable in the body either — fall back to the kind's glyph.
              <span className="flex flex-1 items-center justify-center">
                <KindIcon kind={kind} size={28} className="text-faint" />
              </span>
            )}
            {excerpt ? (
              <KindIcon kind={kind} size={16} className="shrink-0 self-end text-faint" />
            ) : null}
          </div>
        )}

        {videoId ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-black/65 text-white transition group-hover:bg-black/80">
              {/* pl-0.5 optically centres the triangle, which is right-heavy. */}
              <PlayFilledIcon size={20} fill="currentColor" className="pl-0.5" />
            </span>
          </span>
        ) : null}
      </Link>

      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 px-4 pb-3 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND_CHIP[kind]}`}
          >
            <KindIcon kind={kind} size={12} />
            {KIND_LABELS[kind]}
          </span>
          {isNew ? (
            <span
              role="img"
              aria-label="New since your last visit"
              title="New since your last visit"
              className="size-1.5 shrink-0 rounded-full bg-inverse"
            />
          ) : null}
          <span className="min-w-0 flex-1" />
          {saveButton ? <span className="-mr-1.5 shrink-0">{saveButton}</span> : null}
        </div>

        <h3 className="min-w-0">
          <Link
            href={href}
            prefetch
            title={post.title}
            className="line-clamp-2 font-medium leading-snug text-ink underline-offset-4 group-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
          >
            {post.title}
          </Link>
        </h3>

        {/* mt-auto pins the metadata to the bottom, so titles of one and two lines still
            line their footers up across a row of cards. */}
        <p className="mt-auto min-w-0 truncate text-xs text-muted">
          {post.authorName} ·{" "}
          {post.createdAt.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </p>

        {post.tags.length ? (
          <div className="flex min-w-0 flex-wrap gap-1">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/groups/${slug}?tag=${encodeURIComponent(tag)}`}
                className="max-w-full truncate rounded-full bg-rail px-2 py-0.5 text-xs font-medium text-muted transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
              >
                #{tag}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
