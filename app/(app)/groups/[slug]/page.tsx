import Link from "next/link";
import { PageHeader, buttonStyles } from "@/components/page-header";
import { ClearIcon, CommentIcon, InviteIcon, PlusIcon, ReactionIcon } from "@/components/icons";
import { getFeedPage } from "@/lib/queries/feed";
import { countMembers } from "@/lib/queries/groups";
import { requireMember } from "@/lib/guard";

type GroupPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tag?: string | string[];
    before?: string | string[];
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

export default async function GroupPage({
  params,
  searchParams,
}: GroupPageProps) {
  const { slug } = await params;
  const { group, user } = await requireMember(slug);
  const query = await searchParams;
  const tag = first(query.tag)?.trim() || null;
  const before = first(query.before) || null;
  const [feed, memberCount] = await Promise.all([
    getFeedPage({ groupId: group.id, tag, cursor: before }),
    countMembers(group.id),
  ]);
  const loadMoreParams = new URLSearchParams();
  if (tag) loadMoreParams.set("tag", tag);
  if (feed.nextCursor) loadMoreParams.set("before", feed.nextCursor);

  return (
    <main className="min-h-screen w-full px-6 py-10 sm:px-10 sm:py-12">
      {/* one header, one action group — brand + identity live in the sidebar */}
      <PageHeader
        eyebrow="Private group"
        title={group.name}
        meta={
          <>
            <span>{memberCount === 1 ? "1 member" : `${memberCount} members`}</span>
            {tag ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white">
                #{tag}
                <Link
                  href={`/groups/${slug}`}
                  aria-label={`Clear the ${tag} filter`}
                  className="rounded-full text-neutral-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
              Invite people
            </Link>
            <Link href={`/groups/${slug}/new`} className={`${buttonStyles.primary} gap-1.5`}>
              <PlusIcon size={16} />
              New post
            </Link>
          </>
        }
      />

      <section className="pb-10">

        {feed.items.length ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {/* F5 aligned table. min-w forces horizontal scroll rather than squashing
                columns on narrow screens; table-fixed + truncate keeps long titles
                from widening the layout. */}
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  <tr>
                    <th scope="col" className="w-[42%] px-5 py-3 font-medium">Title</th>
                    <th scope="col" className="w-[21%] px-3 py-3 font-medium">Tags</th>
                    <th scope="col" className="w-[12%] px-3 py-3 font-medium">Author</th>
                    <th scope="col" className="w-[9%] px-3 py-3 font-medium">When</th>
                    <th scope="col" className="w-[16%] px-5 py-3 text-right font-medium">Counts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {feed.items.map((post) => (
                    <tr key={post.id} className="group align-middle transition hover:bg-neutral-50">
                      <td className="px-5 py-4">
                        <Link
                          href={`/groups/${slug}/p/${post.id}`}
                          title={post.title}
                          className="block truncate font-medium text-neutral-900 underline-offset-4 group-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                        >
                          {post.title}
                        </Link>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {post.tags.map((postTag) => (
                            <Link
                              key={postTag}
                              href={`/groups/${slug}?tag=${encodeURIComponent(postTag)}`}
                              className="max-w-full truncate rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                            >
                              #{postTag}
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td className="truncate px-3 py-4 text-neutral-500">{post.authorName}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-neutral-500">{postDate(post.createdAt)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-neutral-500">
                        {/* glyphs carry the meaning; the title attribute spells it out */}
                        <span
                          className="tabular-nums"
                          title={`${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}, ${post.reactionCount} ${post.reactionCount === 1 ? "reaction" : "reactions"}`}
                        >
                          <span className={`inline-flex items-center gap-1 ${post.commentCount ? "text-neutral-600" : "text-neutral-300"}`}>
                            <CommentIcon size={14} /> {post.commentCount}
                          </span>
                          <span className="mx-2.5 text-neutral-200">·</span>
                          <span className={`inline-flex items-center gap-1 ${post.reactionCount ? "text-neutral-600" : "text-neutral-300"}`}>
                            <ReactionIcon size={14} /> {post.reactionCount}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {feed.hasMore && feed.nextCursor ? (
              <div className="border-t border-neutral-100 px-5 py-4 text-center">
                <Link
                  href={`/groups/${slug}?${loadMoreParams.toString()}`}
                  className="inline-flex rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                >
                  Load more
                </Link>
              </div>
            ) : null}
          </div>
        ) : tag ? (
          <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
            <h2 className="font-semibold tracking-tight text-neutral-900">Nothing tagged #{tag} yet</h2>
            <p className="mt-2 text-sm text-neutral-500">Try the full feed to see what your group has shared.</p>
            <Link href={`/groups/${slug}`} className="mt-5 inline-flex rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
              Clear filter
            </Link>
          </div>
        ) : before ? (
          <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
            <h2 className="font-semibold tracking-tight text-neutral-900">You’ve reached the end</h2>
            <Link href={`/groups/${slug}`} className="mt-5 inline-flex text-sm font-medium text-neutral-900 underline-offset-4 hover:underline">Back to latest posts</Link>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Share the first useful thing</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">Start with a link or note, then invite friends to build this circle together.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={`/groups/${slug}/new`} className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700">New post</Link>
              <Link href={`/groups/${slug}/settings`} className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Invite people</Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
