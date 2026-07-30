import Link from "next/link";
import { PageHeader, buttonStyles } from "@/components/page-header";
import {
  ClearIcon,
  CommentIcon,
  InviteIcon,
  PlusIcon,
  ReactionIcon,
  SearchIcon,
} from "@/components/icons";
import { MarkSeen } from "@/components/mark-seen";
import { SaveButton } from "@/components/save-button";
import { getFeedPage } from "@/lib/queries/feed";
import { countMembers } from "@/lib/queries/groups";
import { getLastSeen, markGroupSeen } from "@/lib/queries/reads";
import { savedIdsFor } from "@/lib/queries/saved";
import { searchGroupPosts } from "@/lib/queries/search";
import { requireMember } from "@/lib/guard";
import { toggleSaved } from "@/app/(app)/saved/actions";

type GroupPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tag?: string | string[];
    before?: string | string[];
    q?: string | string[];
  }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function postDate(date: Date) {
  const elapsedDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (elapsedDays <= 0) return "Today";
  if (elapsedDays === 1) return "Yesterday";
  if (elapsedDays < 7) return `${elapsedDays} days ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export default async function GroupPage({ params, searchParams }: GroupPageProps) {
  const { slug } = await params;
  const { group, user } = await requireMember(slug);
  const query = await searchParams;
  const tag = first(query.tag)?.trim() || null;
  const before = first(query.before) || null;
  const q = first(query.q)?.trim() || null;

  const [memberCount, lastSeen] = await Promise.all([
    countMembers(group.id),
    getLastSeen(group.id, user.id),
  ]);

  // Searching replaces the feed; the two never combine, so the empty states can be
  // specific about which one you're looking at.
  const searchHits = q ? await searchGroupPosts({ groupId: group.id, query: q }) : null;
  const feed = q
    ? null
    : await getFeedPage({ groupId: group.id, tag, cursor: before });

  const rows = q
    ? (searchHits ?? []).map((hit) => ({
        id: hit.id,
        title: hit.title,
        tags: hit.tags,
        createdAt: new Date(hit.createdAt),
        authorName: hit.authorName,
        commentCount: 0,
        reactionCount: 0,
        ogImage: null as string | null,
      }))
    : (feed?.items ?? []);

  const savedIds = await savedIdsFor(user.id, rows.map((r) => r.id));

  const loadMoreParams = new URLSearchParams();
  if (tag) loadMoreParams.set("tag", tag);
  if (feed?.nextCursor) loadMoreParams.set("before", feed.nextCursor);

  return (
    <main className="min-h-screen w-full px-6 py-10 sm:px-10 sm:py-12">
      {/* clears the unread badge only after this render has painted */}
      <MarkSeen
        mark={async () => {
          "use server";
          const { group: g, user: u } = await requireMember(slug);
          await markGroupSeen(g.id, u.id);
        }}
      />

      <PageHeader
        eyebrow="Private group"
        title={group.name}
        meta={
          <>
            <span>{memberCount === 1 ? "1 member" : `${memberCount} members`}</span>
            {tag ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-inverse px-2.5 py-0.5 text-xs font-medium text-inverse-ink">
                #{tag}
                <Link
                  href={`/groups/${slug}`}
                  aria-label={`Clear the ${tag} filter`}
                  className="rounded-full text-faint transition hover:text-inverse-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ClearIcon size={13} />
                </Link>
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href={`/groups/${slug}/settings`} className={`${buttonStyles.secondary} gap-1.5`}>
              <InviteIcon size={16} />
              <span className="hidden sm:inline">Invite people</span>
            </Link>
            <Link href={`/groups/${slug}/new`} className={`${buttonStyles.primary} gap-1.5`}>
              <PlusIcon size={16} />
              New post
            </Link>
          </>
        }
      />

      <form method="get" className="mt-6 flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <SearchIcon
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder={`Search ${group.name}…`}
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10"
          />
        </div>
        {q ? (
          <Link href={`/groups/${slug}`} className={buttonStyles.secondary}>
            Clear
          </Link>
        ) : null}
      </form>

      <section className="pb-10">
        {rows.length ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm">
                <thead className="border-b border-line text-xs font-medium uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="w-[44%] px-5 py-3 font-medium">Title</th>
                    <th scope="col" className="w-[19%] px-3 py-3 font-medium">Tags</th>
                    <th scope="col" className="w-[12%] px-3 py-3 font-medium">Author</th>
                    <th scope="col" className="w-[9%] px-3 py-3 font-medium">When</th>
                    <th scope="col" className="w-[16%] px-5 py-3 text-right font-medium">Counts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rows.map((post) => {
                    const isNew =
                      !q &&
                      post.authorName !== (user.name ?? "") &&
                      (!lastSeen || post.createdAt > lastSeen);
                    return (
                      <tr key={post.id} className="group align-middle transition hover:bg-hover">
                        <td className="px-5 py-4">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              aria-hidden={!isNew}
                              title={isNew ? "New since your last visit" : undefined}
                              className={`size-1.5 shrink-0 rounded-full ${isNew ? "bg-inverse" : "bg-transparent"}`}
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
                              title={post.title}
                              className="block min-w-0 flex-1 truncate font-medium text-ink underline-offset-4 group-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
                            >
                              {post.title}
                            </Link>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex min-w-0 flex-wrap gap-1">
                            {post.tags.map((postTag) => (
                              <Link
                                key={postTag}
                                href={`/groups/${slug}?tag=${encodeURIComponent(postTag)}`}
                                className="max-w-full truncate rounded-full bg-rail px-2 py-0.5 text-xs font-medium text-muted transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
                              >
                                #{postTag}
                              </Link>
                            ))}
                          </div>
                        </td>
                        <td className="truncate px-3 py-4 text-muted">{post.authorName}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-muted">
                          {postDate(post.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right text-muted">
                          <span className="inline-flex items-center gap-2.5">
                            {!q ? (
                              <span className="tabular-nums">
                                <span className={`inline-flex items-center gap-1 ${post.commentCount ? "text-muted" : "text-faint"}`}>
                                  <CommentIcon size={14} /> {post.commentCount}
                                </span>
                                <span className="mx-2 text-faint">·</span>
                                <span className={`inline-flex items-center gap-1 ${post.reactionCount ? "text-muted" : "text-faint"}`}>
                                  <ReactionIcon size={14} /> {post.reactionCount}
                                </span>
                              </span>
                            ) : null}
                            <SaveButton
                              saved={savedIds.has(post.id)}
                              onToggle={async () => {
                                "use server";
                                await toggleSaved(slug, post.id);
                              }}
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {feed?.hasMore && feed.nextCursor ? (
              <div className="border-t border-hairline px-5 py-4 text-center">
                <Link
                  href={`/groups/${slug}?${loadMoreParams.toString()}`}
                  className={buttonStyles.secondary}
                >
                  Load more
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
            <h2 className="font-semibold tracking-tight text-ink">
              {q
                ? `No results for “${q}”`
                : tag
                  ? `Nothing tagged #${tag} yet`
                  : before
                    ? "You've reached the end"
                    : "No posts yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              {q
                ? "Try fewer or different words."
                : tag
                  ? "Clear the filter to see everything your group has shared."
                  : "Share the first link, note or bit of advice with your circle."}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              {q || tag || before ? (
                <Link href={`/groups/${slug}`} className={buttonStyles.secondary}>
                  Back to the feed
                </Link>
              ) : null}
              {!q && !tag ? (
                <Link href={`/groups/${slug}/new`} className={buttonStyles.primary}>
                  New post
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
