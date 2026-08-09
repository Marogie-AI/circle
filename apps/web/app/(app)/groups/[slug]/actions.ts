"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/db";
import { comments, invites, posts, reactions } from "@/db/schema";
import { requireMember } from "@/lib/guard";
import { safeFetchPreview } from "@/lib/link-preview";
import { isUuid, REACTION_EMOJIS } from "@/lib/post";
import { allow } from "@/lib/rate-limit";

export type PostActionState = { error: string | null };

/**
 * Limits on the two actions that create durable content. Set well above what a person
 * types by hand — the point is to blunt a script, not to nag a fast writer.
 *
 * toggleReaction and the save/unsave toggles are deliberately not limited: they are
 * idempotent against a composite primary key and a fixed emoji allowlist, so hammering
 * them cannot create unbounded rows.
 */
const POST_LIMIT = { max: 20, windowSeconds: 60 };
const COMMENT_LIMIT = { max: 30, windowSeconds: 60 };

function normalizeTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) =>
          tag
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
            .slice(0, 24),
        )
        .filter(Boolean),
    ),
  ).slice(0, 5);
}

async function postInGroup(postId: string, groupId: string) {
  if (!isUuid(postId)) return false;

  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.groupId, groupId)))
    .limit(1);

  return Boolean(post);
}

type PostFields =
  | { ok: true; title: string; body: string; url: string | null; tags: string[] }
  | { ok: false; error: string };

/**
 * One validator for create AND edit. Kept together deliberately: if the two drifted,
 * a rule enforced on create (http/https only) could be bypassed by editing afterwards.
 */
function readPostFields(formData: FormData): PostFields {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const rawUrl = String(formData.get("url") ?? "").trim();

  if (title.length < 1 || title.length > 200) {
    return { ok: false, error: "Title must be between 1 and 200 characters." };
  }
  if (body.length < 1 || body.length > 10_000) {
    return { ok: false, error: "Body must be between 1 and 10,000 characters." };
  }

  let url: string | null = null;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "Link must use http:// or https://." };
      }
      url = parsed.toString();
    } catch {
      return { ok: false, error: "Enter a valid link, including http:// or https://." };
    }
  }

  return {
    ok: true,
    title,
    body,
    url,
    tags: normalizeTags(String(formData.get("tags") ?? "")),
  };
}

/**
 * Attach Open Graph data after the response is sent.
 *
 * `after()` rather than `await`: the fetch has a 5s timeout, and awaiting it would make
 * the user stare at a spinner for five seconds every time they post a link to a slow
 * site. The row is already written, so the preview is pure decoration that lands a
 * moment later. safeFetchPreview enforces the SSRF guards and returns null on failure.
 */
function attachPreview(postId: string, url: string | null) {
  if (!url) return;
  after(async () => {
    const preview = await safeFetchPreview(url);
    await db
      .update(posts)
      .set({
        ogTitle: preview?.title ?? null,
        ogDescription: preview?.description ?? null,
        ogImage: preview?.image ?? null,
        ogSite: preview?.siteName ?? null,
        ogFetchedAt: new Date(),
      })
      .where(eq(posts.id, postId));
  });
}

/**
 * Post mutations are allowed for the author, or for the group owner (moderation).
 * Returned as an extra predicate so it lands INSIDE the mutation's own WHERE clause —
 * a select-then-mutate would leave a window where membership changes in between.
 */
function authorOrOwner(role: string, userId: string) {
  return role === "owner" ? undefined : eq(posts.authorId, userId);
}

export async function createInvite(slug: string) {
  const { group, user } = await requireMember(slug);
  const now = new Date();

  await db.insert(invites).values({
    token: randomBytes(24).toString("base64url"),
    groupId: group.id,
    createdBy: user.id,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  });

  revalidatePath(`/groups/${slug}/settings`);
}

export async function revokeInvite(slug: string, token: string) {
  const { group } = await requireMember(slug);

  await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.token, token), eq(invites.groupId, group.id)));

  revalidatePath(`/groups/${slug}/settings`);
}

export async function createPost(
  slug: string,
  formData: FormData,
): Promise<PostActionState> {
  const { group, user } = await requireMember(slug);
  const fields = readPostFields(formData);
  if (!fields.ok) return { error: fields.error };

  if (!(await allow(`post:${user.id}`, POST_LIMIT.max, POST_LIMIT.windowSeconds))) {
    return { error: "You are posting very fast. Wait a moment and try again." };
  }

  const [newPost] = await db
    .insert(posts)
    .values({
      groupId: group.id,
      authorId: user.id,
      title: fields.title,
      body: fields.body,
      url: fields.url,
      tags: fields.tags,
    })
    .returning({ id: posts.id });

  attachPreview(newPost.id, fields.url);

  redirect(`/groups/${slug}/p/${newPost.id}`);
}

export async function updatePost(
  slug: string,
  postId: string,
  formData: FormData,
): Promise<PostActionState> {
  const { group, user, role } = await requireMember(slug);
  const fields = readPostFields(formData);
  if (!fields.ok) return { error: fields.error };
  if (!isUuid(postId)) notFound();

  const [updated] = await db
    .update(posts)
    .set({
      title: fields.title,
      body: fields.body,
      url: fields.url,
      tags: fields.tags,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.groupId, group.id), // never a client-supplied group
        authorOrOwner(role, user.id),
      ),
    )
    .returning({ id: posts.id, url: posts.url });

  // no row matched => not this group's post, or not yours to edit. Same 404 either way.
  if (!updated) notFound();

  attachPreview(updated.id, fields.url);
  revalidatePath(`/groups/${slug}/p/${postId}`);
  redirect(`/groups/${slug}/p/${postId}`);
}

export async function deletePost(slug: string, postId: string) {
  const { group, user, role } = await requireMember(slug);
  if (!isUuid(postId)) notFound();

  const [deleted] = await db
    .delete(posts)
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.groupId, group.id),
        authorOrOwner(role, user.id),
      ),
    )
    .returning({ id: posts.id });

  if (!deleted) notFound();

  // comments, reactions and saved_posts rows go with it via ON DELETE CASCADE
  revalidatePath(`/groups/${slug}`);
  redirect(`/groups/${slug}`);
}

export async function updateComment(
  slug: string,
  postId: string,
  commentId: string,
  formData: FormData,
) {
  const { group, user, role } = await requireMember(slug);
  const body = String(formData.get("body") ?? "").trim();

  if (body.length < 1 || body.length > 5_000) {
    throw new Error("Comment must be between 1 and 5,000 characters.");
  }
  if (!isUuid(commentId)) notFound();
  // scope the comment to a post that is genuinely in this group
  if (!(await postInGroup(postId, group.id))) notFound();

  const [updated] = await db
    .update(comments)
    .set({ body })
    .where(
      and(
        eq(comments.id, commentId),
        eq(comments.postId, postId),
        role === "owner" ? undefined : eq(comments.authorId, user.id),
      ),
    )
    .returning({ id: comments.id });

  if (!updated) notFound();
  revalidatePath(`/groups/${slug}/p/${postId}`);
}

export async function deleteComment(
  slug: string,
  postId: string,
  commentId: string,
) {
  const { group, user, role } = await requireMember(slug);
  if (!isUuid(commentId)) notFound();
  if (!(await postInGroup(postId, group.id))) notFound();

  const [deleted] = await db
    .delete(comments)
    .where(
      and(
        eq(comments.id, commentId),
        eq(comments.postId, postId),
        role === "owner" ? undefined : eq(comments.authorId, user.id),
      ),
    )
    .returning({ id: comments.id });

  if (!deleted) notFound();
  revalidatePath(`/groups/${slug}/p/${postId}`);
}

export async function addComment(
  slug: string,
  postId: string,
  formData: FormData,
) {
  const { group, user } = await requireMember(slug);
  const body = String(formData.get("body") ?? "").trim();

  if (body.length < 1 || body.length > 5_000) {
    throw new Error("Comment must be between 1 and 5,000 characters.");
  }
  if (
    !(await allow(`comment:${user.id}`, COMMENT_LIMIT.max, COMMENT_LIMIT.windowSeconds))
  ) {
    throw new Error("You are commenting very fast. Wait a moment and try again.");
  }
  if (!(await postInGroup(postId, group.id))) notFound();

  await db.insert(comments).values({ postId, authorId: user.id, body });
  revalidatePath(`/groups/${slug}/p/${postId}`);
}

export async function toggleReaction(
  slug: string,
  postId: string,
  emoji: string,
) {
  const { group, user } = await requireMember(slug);

  if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
    throw new Error("Unsupported reaction.");
  }
  if (!(await postInGroup(postId, group.id))) notFound();

  const existing = await db
    .select({ emoji: reactions.emoji })
    .from(reactions)
    .where(
      and(
        eq(reactions.postId, postId),
        eq(reactions.userId, user.id),
        eq(reactions.emoji, emoji),
      ),
    )
    .limit(1);

  if (existing.length) {
    await db
      .delete(reactions)
      .where(
        and(
          eq(reactions.postId, postId),
          eq(reactions.userId, user.id),
          eq(reactions.emoji, emoji),
        ),
      );
  } else {
    await db
      .insert(reactions)
      .values({ postId, userId: user.id, emoji })
      .onConflictDoNothing();
  }

  revalidatePath(`/groups/${slug}/p/${postId}`);
}
