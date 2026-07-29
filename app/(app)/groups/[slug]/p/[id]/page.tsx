import { and, asc, count, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { addComment, toggleReaction } from "@/app/(app)/groups/[slug]/actions";
import { db } from "@/db";
import { comments, posts, reactions, user as users } from "@/db/schema";
import { buttonStyles } from "@/components/page-header";
import { BackIcon, ExternalIcon, PlusIcon } from "@/components/icons";
import { ReactionGlyph } from "@/components/reaction-glyph";
import { Avatar, AvatarStack } from "@/components/avatar";
import { requireMember } from "@/lib/guard";
import { isUuid, REACTION_EMOJIS, REACTION_LABELS } from "@/lib/post";

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
  const { group, user } = await requireMember(slug);
  if (!isUuid(id)) notFound();

  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      url: posts.url,
      tags: posts.tags,
      createdAt: posts.createdAt,
      authorName: users.name,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.id, id), eq(posts.groupId, group.id)))
    .limit(1);

  if (!post) notFound();

  const [commentRows, reactionCounts, currentUserReactions, reactorRows] = await Promise.all([
    db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        authorName: users.name,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(eq(comments.postId, post.id))
      .orderBy(asc(comments.createdAt)),
    db
      .select({ emoji: reactions.emoji, count: count() })
      .from(reactions)
      .where(eq(reactions.postId, post.id))
      .groupBy(reactions.emoji),
    db
      .select({ emoji: reactions.emoji })
      .from(reactions)
      .where(
        and(
          eq(reactions.postId, post.id),
          eq(reactions.userId, user.id),
        ),
      ),
    // Who reacted, for the avatar stack. Bounded — the grouped count query above stays
    // authoritative for totals, so this never has to load every reactor on a hot post.
    db
      .select({ name: users.name })
      .from(reactions)
      .innerJoin(users, eq(users.id, reactions.userId))
      .where(eq(reactions.postId, post.id))
      .orderBy(asc(reactions.createdAt))
      .limit(24),
  ]);
  const counts = new Map(reactionCounts.map((row) => [row.emoji, row.count]));
  const selected = new Set(currentUserReactions.map((row) => row.emoji));
  const reactorNames = [...new Set(reactorRows.map((row) => row.name))];
  const totalReactions = reactionCounts.reduce((sum, row) => sum + row.count, 0);

  return (
    <main className="min-h-screen w-full px-6 py-10 sm:px-10 sm:py-12">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <Link href={`/groups/${slug}`} className="group inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-900">
          <BackIcon size={16} className="transition group-hover:-translate-x-0.5" />
          <span className="truncate">{group.name}</span>
        </Link>
        <Link href={`/groups/${slug}/new`} className={`${buttonStyles.secondary} gap-1.5`}>
          <PlusIcon size={16} />
          New post
        </Link>
      </header>

      {/* P2: body keeps a reading measure on the left, reactions + comments ride a
          sticky rail on the right. Stacks to one column below lg. */}
      <div className="grid min-w-0 gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <article className="min-w-0 max-w-[68ch]">
        <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-tight text-neutral-900">{post.title}</h1>
        <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
          <Avatar name={post.authorName} size="sm" />
          <span className="min-w-0 truncate">{post.authorName} · {fullDate(post.createdAt)}</span>
        </div>

        {post.tags.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link key={tag} href={`/groups/${slug}?tag=${encodeURIComponent(tag)}`} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900">#{tag}</Link>
            ))}
          </div>
        ) : null}

        {post.url ? (
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="mt-7 flex min-w-0 items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-900 transition hover:border-neutral-300 hover:bg-neutral-100">
            <span className="min-w-0 truncate">{post.url}</span>
            <ExternalIcon size={16} className="shrink-0 text-neutral-400" />
          </a>
        ) : null}

        <div className="mt-8 break-words text-[1.0625rem] leading-8 text-neutral-700">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h2 className="mb-3 mt-8 text-2xl font-semibold tracking-tight text-neutral-900">{children}</h2>,
              h2: ({ children }) => <h2 className="mb-3 mt-8 text-xl font-semibold tracking-tight text-neutral-900">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-2 mt-6 text-lg font-semibold text-neutral-900">{children}</h3>,
              p: ({ children }) => <p className="my-4">{children}</p>,
              a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-neutral-900 underline underline-offset-4">{children}</a>,
              ul: ({ children }) => <ul className="my-4 list-disc space-y-1 pl-6">{children}</ul>,
              ol: ({ children }) => <ol className="my-4 list-decimal space-y-1 pl-6">{children}</ol>,
              blockquote: ({ children }) => <blockquote className="my-5 border-l-2 border-neutral-300 pl-4 text-neutral-600">{children}</blockquote>,
              code: ({ children }) => <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm text-neutral-900">{children}</code>,
              pre: ({ children }) => <pre className="my-5 overflow-x-auto rounded-xl bg-neutral-900 p-4 text-sm leading-6 text-neutral-100">{children}</pre>,
              hr: () => <hr className="my-8 border-neutral-200" />,
              table: ({ children }) => <div className="my-5 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>,
              th: ({ children }) => <th className="border border-neutral-300 bg-neutral-50 px-3 py-2 text-left font-semibold text-neutral-900">{children}</th>,
              td: ({ children }) => <td className="border border-neutral-300 px-3 py-2">{children}</td>,
            }}
          >
            {post.body}
          </ReactMarkdown>
        </div>

      </article>

      <aside className="min-w-0 lg:sticky lg:top-6 lg:h-fit">
        <section aria-label="Reactions" className="rounded-2xl border border-neutral-200 bg-white p-3">
          {/* X-style: a quiet inline row of icon buttons, not a labelled 2-col grid.
              Stored values stay emoji (REACTION_EMOJIS); only the rendering is icons. */}
          <div className="flex flex-wrap gap-1">
            {REACTION_EMOJIS.map((emoji) => {
              const active = selected.has(emoji);
              const count = counts.get(emoji) ?? 0;
              const label = REACTION_LABELS[emoji] ?? "React";
              return (
                <form key={emoji} action={toggleReaction.bind(null, slug, post.id, emoji)}>
                  <button
                    type="submit"
                    aria-pressed={active}
                    aria-label={`${label} (${count})`}
                    title={`${label} · ${count}`}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ${
                      active
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    <ReactionGlyph emoji={emoji} size={17} />
                    {/* hide the 0 entirely rather than printing a dim zero six times */}
                    {count > 0 ? (
                      <span className="tabular-nums text-xs font-medium">{count}</span>
                    ) : null}
                  </button>
                </form>
              );
            })}
          </div>

          {reactorNames.length > 0 ? (
            <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3">
              <AvatarStack names={reactorNames} />
              <p className="min-w-0 truncate text-xs text-neutral-500">
                {totalReactions === 1 ? "1 reaction" : `${totalReactions} reactions`}
              </p>
            </div>
          ) : null}
        </section>

      <section aria-labelledby="comments-heading" className="mt-5 pb-16">
        <h2 id="comments-heading" className="text-sm font-semibold tracking-tight text-neutral-900">Comments <span className="font-normal text-neutral-400">{commentRows.length}</span></h2>
        <form action={addComment.bind(null, slug, post.id)} className="mt-3">
          <label htmlFor="comment" className="sr-only">Add a comment</label>
          <textarea id="comment" name="body" required minLength={1} maxLength={5000} rows={3} placeholder="Add a comment…" className="w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10" />
          <div className="mt-3 flex justify-end">
            <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2">Comment</button>
          </div>
        </form>

        {commentRows.length ? (
          <ul className="mt-5 divide-y divide-neutral-200 border-t border-neutral-200">
            {commentRows.map((comment) => (
              <li key={comment.id} className="flex gap-2.5 py-4">
                <Avatar name={comment.authorName} size="sm" className="mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900">
                    {comment.authorName}{" "}
                    <span className="font-normal text-neutral-400">· {fullDate(comment.createdAt)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-600">{comment.body}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {/* deliberately no empty-state card: the compose box above already reads
            "Add a comment…", so a second "no comments yet" panel is redundant noise */}
      </section>
      </aside>
      </div>
    </main>
  );
}
