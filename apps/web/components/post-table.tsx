import Link from "next/link";
import type { ReactNode } from "react";
import { KindIcon } from "@/components/kind-icon";
import type { PostCardPost } from "@/components/post-card";
import { DEFAULT_POST_KIND, KIND_LABELS, parsePostKind } from "@/lib/kind";

/**
 * The dense alternative to the card grid, chosen with the layout toggle.
 *
 * Kept as a real <table> rather than a grid of divs: this is tabular data with column
 * headers, and screen readers get row/column semantics for free.
 */
export function PostTable({
  rows,
  slug,
  isNew,
  saveButton,
}: {
  rows: PostCardPost[];
  slug: string;
  /** Per-row, so the page keeps the "unseen since last visit" rule in one place. */
  isNew: (post: PostCardPost) => boolean;
  saveButton: (post: PostCardPost) => ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-left text-sm sm:min-w-[760px]">
        <thead className="text-xs font-medium uppercase tracking-wide text-muted">
          <tr>
            {/* pl-9 = px-5 (20px) + the unread dot (6px) + its gap (10px), so the
                heading sits over the title text rather than over the dot. */}
            {/* Widths differ by breakpoint: on a phone the type and tag columns are
                gone, so title and author split the space they gave up. */}
            <th scope="col" className="w-[64%] py-3 pl-9 pr-5 font-medium sm:w-[38%]">
              Title
            </th>
            <th scope="col" className="hidden px-3 py-3 font-medium sm:table-cell sm:w-[10%]">
              Type
            </th>
            <th scope="col" className="hidden w-[24%] px-3 py-3 font-medium sm:table-cell">
              Tags
            </th>
            <th scope="col" className="w-[24%] px-3 py-3 font-medium sm:w-[14%]">
              Author
            </th>
            <th scope="col" className="hidden px-3 py-3 font-medium sm:table-cell sm:w-[9%]">
              Date
            </th>
            {/* Save control keeps its column but not a label — "Saved" as a heading
                would read as a filter rather than a per-row toggle. */}
            <th scope="col" className="w-[12%] px-3 py-3 sm:w-[5%] sm:px-5">
              <span className="sr-only">Saved</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((post) => {
            const kind = parsePostKind(post.kind) ?? DEFAULT_POST_KIND;
            const unseen = isNew(post);
            return (
              <tr key={post.id} className="group align-middle transition hover:bg-hover">
                <td className="px-5 py-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden={!unseen}
                      title={unseen ? "New since your last visit" : undefined}
                      className={`size-1.5 shrink-0 rounded-full ${
                        unseen ? "bg-inverse" : "bg-transparent"
                      }`}
                    />
                    {post.ogImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.ogImage}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="hidden size-9 shrink-0 rounded-md object-cover sm:block"
                      />
                    ) : null}
                    <Link
                      href={`/groups/${slug}/p/${post.id}`}
                      prefetch
                      title={post.title}
                      className="block min-w-0 flex-1 truncate font-medium text-ink underline-offset-4 group-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
                    >
                      {post.title}
                    </Link>
                  </div>
                </td>
                <td className="hidden px-3 py-4 sm:table-cell">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted">
                    <KindIcon kind={kind} size={13} />
                    {KIND_LABELS[kind]}
                  </span>
                </td>
                <td className="hidden px-3 py-4 sm:table-cell">
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
                </td>
                <td className="truncate px-3 py-4 text-muted">{post.authorName}</td>
                <td className="hidden whitespace-nowrap px-3 py-4 text-muted sm:table-cell">
                  {post.createdAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-right text-muted sm:px-5">
                  {saveButton(post)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
