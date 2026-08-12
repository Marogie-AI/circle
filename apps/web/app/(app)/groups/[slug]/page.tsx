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
import { PostCard } from "@/components/post-card";
import { PostTable } from "@/components/post-table";
import { SaveButton } from "@/components/save-button";
import { ViewToggle } from "@/components/view-toggle";
import { ManageCollectionsButton } from "@/components/manage-collections-button";
import { DEFAULT_FEED_VIEW, parseFeedView } from "@/lib/feed-view";
import { KIND_LABELS, parsePostKind } from "@/lib/kind";
import { getFeedPage, getPinnedPosts, parseFeedSort } from "@/lib/queries/feed";
import { listGroupCollections } from "@/lib/queries/group-collections";
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
    kind?: string | string[];
    view?: string | string[];
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
  const { group, user, role } = await requireMember(slug);
  const query = await searchParams;
  const tag = first(query.tag)?.trim() || null;
  const before = first(query.before) || null;
  const q = first(query.q)?.trim() || null;
  const sort = parseFeedSort(first(query.sort));
  const requestedAuthor = first(query.author)?.trim() || null;
  // Unknown kinds become "no filter" rather than an error — same posture as the sort.
  const kind = parsePostKind(first(query.kind));
  const view = parseFeedView(first(query.view));

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
        kind,
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
        ogImage: hit.ogImage ?? null,
        url: hit.url ?? null,
        kind: hit.kind ?? null,
        excerpt: hit.excerpt ?? null,
      }))
    : (feed?.items ?? []);

  // Pinned strip shows only on the plain top-level view — never mid-filter or paginated,
  // where it would be confusing to see posts that ignore the active filter.
  const showPinned = !q && !tag && !author && !kind && !before;
  const pinned = showPinned ? await getPinnedPosts(group.id) : [];
  const collections = await listGroupCollections(group.id);

  const savedIds = await savedIdsFor(user.id, rows.map((r) => r.id));

  // Every active filter has to ride along, or page 2 quietly resets them.
  const loadMoreParams = new URLSearchParams();
  if (tag) loadMoreParams.set("tag", tag);
  if (author) loadMoreParams.set("author", author.id);
  if (kind) loadMoreParams.set("kind", kind);
  if (view !== DEFAULT_FEED_VIEW) loadMoreParams.set("view", view);
  if (sort !== "new") loadMoreParams.set("sort", sort);
  if (feed?.nextCursor) loadMoreParams.set("before", feed.nextCursor);

  /** URL with one filter dropped, for the dismiss buttons on the chips. */
  function urlWithout(key: "tag" | "author" | "kind") {
    const next = new URLSearchParams();
    if (tag && key !== "tag") next.set("tag", tag);
    if (author && key !== "author") next.set("author", author.id);
    if (kind && key !== "kind") next.set("kind", kind);
    // Layout is not a filter — clearing a filter must never reset it.
    if (view !== DEFAULT_FEED_VIEW) next.set("view", view);
    if (sort !== "new") next.set("sort", sort);
    const queryString = next.toString();
    return queryString ? `/groups/${slug}?${queryString}` : `/groups/${slug}`;
  }

  /**
   * Unseen since this member's last visit. One definition, shared by both layouts — the
   * card grid and the table showed the same dot from two copies of this before.
   */
  function isUnseen(post: { authorName: string; createdAt: Date }) {
    return (
      !q &&
      post.authorName !== (user.name ?? "") &&
      (!lastSeen || post.createdAt > lastSeen)
    );
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

      {group.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={group.coverUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="mb-6 h-32 w-full rounded-2xl border border-line object-cover sm:h-40"
        />
      ) : null}

      {/* No eyebrow: every group in this app is private, so "Private group" above the
          name said nothing the user did not already know. */}
      <PageHeader
        title={
          // With a category selected the title becomes a breadcrumb. The group name is
          // the link back to the unfiltered feed, so it does the job the dismissable
          // chip used to do — one control instead of two saying the same thing.
          kind ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <Link
                href={urlWithout("kind")}
                className="min-w-0 shrink truncate text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
              >
                {group.name}
              </Link>
              {/* Inline SVG rather than an icon from components/icons.tsx: that module
                  is "use client", so pulling a glyph from it into this server component
                  creates a client reference for what is pure decoration. A separator
                  does not need to cross that boundary. */}
              <svg
                role="presentation"
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5 shrink-0 text-faint"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
              <span className="shrink-0">{KIND_LABELS[kind]}</span>
            </span>
          ) : (
            group.name
          )
        }
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
            {/* No chip for the category — it lives in the breadcrumb above. */}
          </>
        }
        actions={
          <>
            {role === "owner" ? (
              <Link href={`/groups/${slug}/settings`} className={`${buttonStyles.secondary} gap-1.5`}>
                <InviteIcon size={16} />
                <span className="hidden sm:inline">Invite people</span>
              </Link>
            ) : null}
            <ManageCollectionsButton slug={slug} collections={collections} />
            <Link href={`/groups/${slug}/drafts`} className={`${buttonStyles.secondary} gap-1.5`}>
              <span className="hidden sm:inline">Drafts</span>
              <span className="sm:hidden">✎</span>
            </Link>
            <Link href={`/groups/${slug}/new`} className={`${buttonStyles.primary} gap-1.5`}>
              <PlusIcon size={16} />
              New post
            </Link>
          </>
        }
      />

      {group.description ? (
        <p className="mt-3 max-w-2xl text-sm text-muted">{group.description}</p>
      ) : null}

      <form method="get" className="mt-6 flex flex-wrap items-center gap-4">
        {/* Searching replaces the feed entirely, so the feed's own filters would be
            lying about what is on screen. They come back when the search clears. */}
        {tag ? <input type="hidden" name="tag" value={tag} /> : null}
        {kind ? <input type="hidden" name="kind" value={kind} /> : null}
        {view !== DEFAULT_FEED_VIEW ? (
          <input type="hidden" name="view" value={view} />
        ) : null}
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
        {/* Layout stays available while searching — the hits render in it too. */}
        <ViewToggle slug={slug} />
      </form>

      {pinned.length ? (
        <section aria-label="Pinned posts" className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Pinned</h2>
          <ul className="mt-2 divide-y divide-hairline rounded-2xl border border-line bg-surface shadow-sm">
            {pinned.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/groups/${slug}/p/${post.id}`}
                  prefetch
                  className="flex items-center gap-2.5 px-5 py-3 transition hover:bg-hover"
                >
                  <span aria-hidden className="shrink-0 text-muted">📌</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{post.title}</span>
                  <span className="shrink-0 truncate text-xs text-muted">{post.authorName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="pb-10">
        {rows.length ? (
          <>
            {view === "table" ? (
              <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <PostTable
                  rows={rows}
                  slug={slug}
                  isNew={isUnseen}
                  saveButton={(post) => (
                    <SaveButton
                      saved={savedIds.has(post.id)}
                      onToggle={async () => {
                        "use server";
                        await toggleSaved(slug, post.id);
                      }}
                    />
                  )}
                />
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    slug={slug}
                    isNew={isUnseen(post)}
                    saveButton={
                      <SaveButton
                        saved={savedIds.has(post.id)}
                        onToggle={async () => {
                          "use server";
                          await toggleSaved(slug, post.id);
                        }}
                      />
                    }
                  />
                ))}
              </div>
            )}

            {feed?.hasMore && feed.nextCursor ? (
              <div className="mt-6 text-center">
                <Link
                  href={`/groups/${slug}?${loadMoreParams.toString()}`}
                  className={buttonStyles.secondary}
                >
                  Load more
                </Link>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <h2 className="font-semibold tracking-tight text-ink">
              {q
                ? `No results for “${q}”`
                : tag
                  ? `Nothing tagged #${tag} yet`
                  : kind
                    ? `No ${KIND_LABELS[kind].toLowerCase()}s here yet`
                    : before
                      ? "You've reached the end"
                      : "No posts yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              {q
                ? "Try fewer or different words."
                : tag || kind
                  ? "Clear the filter to see everything your group has shared."
                  : "Share the first link, note or bit of advice with your circle."}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              {q || tag || kind || before ? (
                <Link href={`/groups/${slug}`} className={buttonStyles.secondary}>
                  Back to the feed
                </Link>
              ) : null}
              {!q && !tag ? (
                <Link
                  href={
                    kind
                      ? `/groups/${slug}/new?kind=${kind}`
                      : `/groups/${slug}/new`
                  }
                  className={buttonStyles.primary}
                >
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
