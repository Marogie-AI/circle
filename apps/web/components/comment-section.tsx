"use client";

import { useRef, useState, useTransition } from "react";
import {
  addComment,
  loadRootComments,
} from "@/app/(app)/groups/[slug]/actions";
import { CommentThread } from "@/components/comment-thread";
import { MentionTextarea } from "@/components/mention-textarea";
import { SubmitButton } from "@/components/submit-button";
import type { Mentionable } from "@/lib/mentions";
import type { CommentPage, ThreadComment } from "@/lib/queries/comments";

type Props = {
  slug: string;
  postId: string;
  initial: CommentPage;
  totalComments: number;
  members: Mentionable[];
  viewerId: string;
  isOwner: boolean;
};

/**
 * The comment section: a compose box plus the first page of top-level comments (SSR-seeded
 * for first paint), with "Load more comments" paging the rest. Client-owned so a new comment
 * prepends instantly (newest-first) without a full-page revalidate. Replies live inside each
 * CommentThread, loaded on demand — the whole tree is never fetched at once.
 */
export function CommentSection({
  slug,
  postId,
  initial,
  totalComments,
  members,
  viewerId,
  isOwner,
}: Props) {
  const [roots, setRoots] = useState<ThreadComment[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [total, setTotal] = useState(totalComments);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const loadMore = () =>
    startTransition(async () => {
      const page = await loadRootComments(slug, postId, cursor);
      setRoots((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...page.items.filter((c) => !seen.has(c.id))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    });

  return (
    <section
      aria-labelledby="comments-heading"
      className="mt-10 border-t border-line pt-8"
    >
      <h2
        id="comments-heading"
        className="text-base font-semibold tracking-tight text-ink"
      >
        Comments <span className="font-normal text-faint">{total}</span>
      </h2>

      <form
        ref={formRef}
        action={async (formData) => {
          const created = await addComment(slug, postId, formData);
          setRoots((prev) => [created, ...prev]);
          setTotal((n) => n + 1);
          formRef.current?.reset();
        }}
        className="mt-4"
      >
        <label htmlFor="comment" className="sr-only">
          Add a comment
        </label>
        <MentionTextarea
          id="comment"
          name="body"
          members={members}
          required
          minLength={1}
          maxLength={5000}
          rows={3}
          placeholder="Add a comment… use @ to mention"
          className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-6 outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10"
        />
        <div className="mt-3 flex justify-end">
          <SubmitButton
            pendingLabel="Posting…"
            className="rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
          >
            Comment
          </SubmitButton>
        </div>
      </form>

      {roots.length ? (
        <div className="mt-5 divide-y divide-hairline border-t border-hairline">
          {roots.map((comment) => (
            <CommentThread
              key={comment.id}
              slug={slug}
              postId={postId}
              comment={comment}
              members={members}
              viewerId={viewerId}
              isOwner={isOwner}
              depth={0}
              onRemoved={() => {
                setRoots((prev) => prev.filter((c) => c.id !== comment.id));
                setTotal((n) => Math.max(0, n - 1));
              }}
            />
          ))}
        </div>
      ) : null}

      {hasMore ? (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition hover:bg-hover hover:text-ink disabled:opacity-60"
          >
            {pending ? "Loading…" : "Load more comments"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
