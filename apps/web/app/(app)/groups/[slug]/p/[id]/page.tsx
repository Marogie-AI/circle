import { and, count, countDistinct, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  deletePost,
  pinPost,
  publishDraft,
  toggleReaction,
  unpinPost,
} from "@/app/(app)/groups/[slug]/actions";
import { toggleSaved } from "@/app/(app)/saved/actions";
import { db } from "@/db";
import { comments, posts, reactions, user as users } from "@/db/schema";
import { buttonStyles } from "@/components/page-header";
import { BackIcon, PlusIcon } from "@/components/icons";
import { PostEngagement } from "@/components/post-engagement";
import { LinkCard } from "@/components/link-card";
import { AddToCollection } from "@/components/add-to-collection";
import { linkifyMarkdown } from "@/lib/mentions";
import { listGroupMembers } from "@/lib/queries/groups";
import { listRootComments } from "@/lib/queries/comments";
import { listGroupCollections } from "@/lib/queries/group-collections";
import { SaveButton } from "@/components/save-button";
import { PostActionsMenu } from "@/components/post-actions-menu";
import { SubmitButton } from "@/components/submit-button";
import { Avatar } from "@/components/avatar";
import { requireMember } from "@/lib/guard";
import { isSaved } from "@/lib/queries/saved";
import { isUuid, LIKE_EMOJI } from "@/lib/post";

type PostPageProps = {
  params: Promise<{ slug: string; id: string }>;
};

function fullDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug, id } = await params;
  const { group, user, role } = await requireMember(slug);
  if (!isUuid(id)) notFound();

  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      url: posts.url,
      tags: posts.tags,
      updatedAt: posts.updatedAt,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      status: posts.status,
      pinnedAt: posts.pinnedAt,
      ogTitle: posts.ogTitle,
      ogDescription: posts.ogDescription,
      ogImage: posts.ogImage,
      ogSite: posts.ogSite,
      authorName: users.name,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.id, id), eq(posts.groupId, group.id)))
    .limit(1);

  if (!post) notFound();
  // Drafts are private to their author. Everyone else gets a 404 — never a "you can't
  // see this", which would leak that a draft exists.
  if (post.status === "draft" && post.authorId !== user.id) notFound();

  const [
    rootPage,
    commentTotal,
    reactionCounts,
    currentUserReactions,
    saved,
    groupMembers,
    groupCollections,
  ] = await Promise.all([
    // First page of top-level comments, each hydrated with its like state and direct-reply
    // count. Replies load lazily per node — the whole tree is never fetched here.
    listRootComments(post.id, null, user.id),
    // Total comment count (all depths) for the section header — one indexed COUNT.
    db
      .select({ n: count() })
      .from(comments)
      .where(eq(comments.postId, post.id)),
    // countDistinct on user_id, NOT a sum of per-emoji counts: one member can still hold
    // more than one legacy emoji row on the same post, and summing would count them
    // twice. A like is a person, not a row.
    db
      .select({ users: countDistinct(reactions.userId) })
      .from(reactions)
      .where(eq(reactions.postId, post.id)),
    db
      .select({ emoji: reactions.emoji })
      .from(reactions)
      .where(
        and(
          eq(reactions.postId, post.id),
          eq(reactions.userId, user.id),
        ),
      ),
    // In the same batch: it only needs post.id and user.id, both already known, so
    // awaiting it separately was one more sequential round-trip for nothing.
    isSaved(user.id, post.id),
    listGroupMembers(group.id),
    listGroupCollections(group.id),
  ]);
  // One like per member, counted across every emoji ever stored — see LIKE_EMOJI.
  const likeCount = reactionCounts[0]?.users ?? 0;
  const liked = currentUserReactions.length > 0;
  const totalComments = Number(commentTotal[0]?.n ?? 0);
  // presentational only — the actions re-check this in their own WHERE clause
  const canManagePost = role === "owner" || post.authorId === user.id;

  return (
    // Full width, matching the group feed's own padding. Reactions and comments follow
    // the article in the same column rather than riding a sidebar: the body is the thing
    // being read, and a 300px rail put the comment box level with the title.
    <main className="min-h-full w-full min-w-0 px-6 pb-10 pt-9 sm:px-10 sm:pb-16">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line pb-5">
        <Link href={`/groups/${slug}`} className="group inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink">
          <BackIcon size={16} className="transition group-hover:-translate-x-0.5" />
          <span className="truncate">Back</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {post.status === "published" ? (
            <SaveButton
              saved={saved}
              variant="labelled"
              onToggle={async () => {
                "use server";
                await toggleSaved(slug, post.id);
              }}
            />
          ) : null}
          {role === "owner" && post.status !== "draft" ? (
            <form
              action={async () => {
                "use server";
                if (post.pinnedAt) {
                  await unpinPost(slug, post.id);
                } else {
                  await pinPost(slug, post.id);
                }
              }}
            >
              <SubmitButton
                pendingLabel={post.pinnedAt ? "Unpinning…" : "Pinning…"}
                className={`${buttonStyles.secondary}`}
              >
                {post.pinnedAt ? "Unpin" : "Pin"}
              </SubmitButton>
            </form>
          ) : null}
          {post.status === "published" ? (
            <AddToCollection slug={slug} postId={post.id} collections={groupCollections} />
          ) : null}
          <Link href={`/groups/${slug}/new`} className={`${buttonStyles.secondary} gap-1.5`}>
            <PlusIcon size={16} />
            <span className="hidden sm:inline">New post</span>
          </Link>
          {canManagePost ? (
            <PostActionsMenu
              editHref={`/groups/${slug}/p/${post.id}/edit`}
              onDelete={async () => {
                "use server";
                await deletePost(slug, post.id);
              }}
            />
          ) : null}
        </div>
      </header>

      {post.status === "draft" ? (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-dashed border-line bg-canvas px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">Draft</span> — only you can see this. Publishing
            shares it with the group.
          </p>
          <form action={publishDraft.bind(null, slug, post.id)}>
            <SubmitButton
              pendingLabel="Publishing…"
              className="rounded-lg bg-inverse px-4 py-2 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
            >
              Publish
            </SubmitButton>
          </form>
        </div>
      ) : null}

      <article className="min-w-0 pt-10">
        <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-tight text-ink">{post.title}</h1>
        <div className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Avatar name={post.authorName} size="sm" />
          <span className="min-w-0 truncate">
            {post.authorName} · {fullDate(post.createdAt)}
            {post.updatedAt.getTime() - post.createdAt.getTime() > 1000 ? " · edited" : ""}
          </span>
        </div>

        {post.tags.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link key={tag} href={`/groups/${slug}?tag=${encodeURIComponent(tag)}`} className="rounded-full bg-rail px-2.5 py-1 text-xs font-medium text-muted hover:bg-hover hover:text-ink">#{tag}</Link>
            ))}
          </div>
        ) : null}

        {post.url ? (
          <LinkCard
            url={post.url}
            title={post.ogTitle}
            description={post.ogDescription}
            image={post.ogImage}
            site={post.ogSite}
          />
        ) : null}

        <div className="mt-8 break-words text-[1.0625rem] leading-8 text-ink">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h2 className="mb-3 mt-8 text-2xl font-semibold tracking-tight text-ink">{children}</h2>,
              h2: ({ children }) => <h2 className="mb-3 mt-8 text-xl font-semibold tracking-tight text-ink">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-2 mt-6 text-lg font-semibold text-ink">{children}</h3>,
              p: ({ children }) => <p className="my-4">{children}</p>,
              a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-4">{children}</a>,
              ul: ({ children }) => <ul className="md-bullets my-4 space-y-1 pl-6">{children}</ul>,
              ol: ({ children }) => <ol className="my-4 list-decimal space-y-1 pl-6">{children}</ol>,
              blockquote: ({ children }) => <blockquote className="my-5 border-l-2 border-line pl-4 text-muted">{children}</blockquote>,
              code: ({ children }) => <code className="rounded bg-rail px-1.5 py-0.5 text-sm text-ink">{children}</code>,
              pre: ({ children }) => <pre className="my-5 overflow-x-auto rounded-xl bg-inverse p-4 text-sm leading-6 text-inverse-ink">{children}</pre>,
              hr: () => <hr className="my-8 border-line" />,
              table: ({ children }) => <div className="my-5 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>,
              th: ({ children }) => <th className="border border-line bg-canvas px-3 py-2 text-left font-semibold text-ink">{children}</th>,
              td: ({ children }) => <td className="border border-line px-3 py-2">{children}</td>,
            }}
          >
            {linkifyMarkdown(post.body, groupMembers)}
          </ReactMarkdown>
        </div>

      </article>

      {post.status === "published" ? (
        <PostEngagement
          slug={slug}
          postId={post.id}
          likes={likeCount}
          liked={liked}
          totalComments={totalComments}
          shareUrl={`/groups/${slug}/p/${post.id}`}
          onToggleLike={async () => {
            "use server";
            await toggleReaction(slug, post.id, LIKE_EMOJI);
          }}
          initial={rootPage}
          members={groupMembers}
          viewerId={user.id}
          isOwner={role === "owner"}
        />
      ) : null}
    </main>
  );
}
