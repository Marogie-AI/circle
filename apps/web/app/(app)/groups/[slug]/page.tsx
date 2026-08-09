import Link from "next/link";
import { PageHeader, buttonStyles } from "@/components/page-header";
import {
  ClearIcon,
  InviteIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/icons";
import { FeedFilters } from "@/components/feed-filters";
import { MarkSeen } from "@/components/mark-seen";
import { SaveButton } from "@/components/save-button";
import { getFeedPage, parseFeedSort } from "@/lib/queries/feed";
import { listGroupMembers, listTagFacets } from "@/lib/queries/groups";
import { getLastSeen, markGroupSeen } from "@/lib/queries/reads";
import { savedIdsFor } from "@/lib/queries/saved";
import { searchGroupPosts } from "@/lib/queries/search";
import { requireMember } from "@/lib/guard";
import { toggleSaved } from "@/app/(app)/saved/actions";

type GroupPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tag?: string | string[];
    author?: string | string[];
    sort?: string | string[];
    before?: string | string[];
    q?: string | string[];
  }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GroupPage({ params, searchParams }: GroupPageProps) {
  const { slug } = await params;
  const { group, user } = await requireMember(slug);
  const query = await searchParams;
  const tag = first(query.tag)?.trim() || null;
  const before = first(query.before) || null;
  const q = first(query.q)?.trim() || null;
  const sort = parseFeedSort(first(query.sort));
  const requestedAuthor = first(query.author)?.trim() || null;

  const [lastSeen, members, tagFacets] = await Promise.all([
    getLastSeen(group.id, user.id),
    listGroupMembers(group.id),
    listTagFacets(group.id),
  ]);

  // An author id from the URL is only honoured if it belongs to this group. Otherwise a
  // crafted ?author= would be a (harmless, but pointless) probe against other users.
  const author = members.find((member) => member.id === requestedAuthor) ?? null;

  // Searching replaces the feed; the two never combine, so the empty states can be
  // specific about which one you're looking at.
  const searchHits = q ? await searchGroupPosts({ groupId: group.id, query: q }) : null;
  const feed = q
    ? null
    : await getFeedPage({
        groupId: group.id,
        tag,
        authorId: author?.id ?? null,
        sort,
        cursor: before,
      });

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

  // Every active filter has to ride along, or page 2 quietly resets them.
  const loadMoreParams = new URLSearchParams();
  if (tag) loadMoreParams.set("tag", tag);
  if (author) loadMoreParams.set("author", author.id);
  if (sort !== "new") loadMoreParams.set("sort", sort);
  if (feed?.nextCursor) loadMoreParams.set("before", feed.nextCursor);

  /** URL with one filter dropped, for the dismiss buttons on the chips. */
  function urlWithout(key: "tag" | "author") {
    const next = new URLSearchParams();
    if (tag && key !== "tag") next.set("tag", tag);
    if (author && key !== "author") next.set("author", author.id);
    if (sort !== "new") next.set("sort", sort);
    const queryString = next.toString();
    return queryString ? `/groups/${slug}?${queryString}` : `/groups/${slug}`;
  }

  const chip =
    "inline-flex items-center gap-1.5 rounded-full bg-inverse px-2.5 py-0.5 text-xs font-medium text-inverse-ink";
  const chipDismiss =
    "rounded-full text-faint transition hover:text-inverse-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <main className="min-h-full w-full min-w-0 px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
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
            {tag ? (
              <span className={chip}>
                #{tag}
                <Link
                  href={urlWithout("tag")}
                  aria-label={`Clear the ${tag} filter`}
                  className={chipDismiss}
                >
                  <ClearIcon size={13} />
                </Link>
              </span>
            ) : null}
            {author ? (
              <span className={chip}>
                {author.name}
                <Link
                  href={urlWithout("author")}
                  aria-label={`Clear the ${author.name} filter`}
                  className={chipDismiss}
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

      <form method="get" className="mt-6 flex flex-wrap items-center gap-4">
        {/* Searching replaces the feed entirely, so the feed's own filters would be
            lying about what is on screen. They come back when the search clears. */}
        {tag ? <input type="hidden" name="tag" value={tag} /> : null}
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
        {/* A real submit button, hidden. Without one, pressing Enter in the search
            field did nothing: implicit submission stops once the form holds controls
            besides the single text input, and this form also carries the filters. */}
        <button type="submit" className="sr-only">
          Search
        </button>
        {q ? (
          <Link href={`/groups/${slug}`} className={buttonStyles.secondary}>
            Clear
          </Link>
        ) : (
          <FeedFilters slug={slug} members={members} tags={tagFacets} />
        )}
      </form>

      <section className="pb-10">
        {rows.length ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full table-fixed sm:min-w-[720px] border-collapse text-left text-sm">
                <thead className="text-xs font-medium uppercase tracking-wide text-muted">
                  <tr>
                    {/* pl-9 = px-5 (20px) + the unread dot (6px) + its gap (10px), so
                        the heading sits over the title text rather than over the dot. */}
                    {/* Widths differ by breakpoint: on a phone the tag column is gone,
                        so title and author split the space the tags gave up. */}
                    <th scope="col" className="w-[64%] py-3 pl-9 pr-5 font-medium sm:w-[52%]">
                      Title
                    </th>
                    <th scope="col" className="hidden w-[28%] px-3 py-3 font-medium sm:table-cell">Tags</th>
                    <th scope="col" className="w-[24%] px-3 py-3 font-medium sm:w-[14%]">Author</th>
                    {/* Save control keeps its column but not a label — "Saved" as a
                        heading would read as a filter rather than a per-row toggle. */}
                    <th scope="col" className="w-[12%] px-3 py-3 sm:w-[6%] sm:px-5">
                      <span className="sr-only">Saved</span>
                    </th>
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
              prefetch
                              title={post.title}
                              className="block min-w-0 flex-1 truncate font-medium text-ink underline-offset-4 group-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
                            >
                              {post.title}
                            </Link>
                          </div>
                        </td>
                        <td className="hidden px-3 py-4 sm:table-cell">
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
                        <td className="whitespace-nowrap px-3 py-4 text-right text-muted sm:px-5">
                          <SaveButton
                            saved={savedIds.has(post.id)}
                            onToggle={async () => {
                              "use server";
                              await toggleSaved(slug, post.id);
                            }}
                          />
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
          <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
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
