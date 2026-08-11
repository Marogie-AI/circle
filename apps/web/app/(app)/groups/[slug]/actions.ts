"use server";

import { randomBytes } from "node:crypto";
import { and, count, eq, isNotNull, lte, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/db";
import {
  commentReactions,
  comments,
  groups,
  invites,
  memberships,
  posts,
  reactions,
} from "@/db/schema";
import { requireMember } from "@/lib/guard";
import { safeFetchPreview } from "@/lib/link-preview";
import { extractMentionIds } from "@/lib/mentions";
import { notify } from "@/lib/notify";
import { isUuid, REACTION_EMOJIS } from "@/lib/post";
import { listGroupMembers } from "@/lib/queries/groups";
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
const PREVIEW_LIMIT = { max: 10, windowSeconds: 60 };
const INVITE_CREATE_LIMIT = { max: 10, windowSeconds: 60 * 60 };
const MAX_ACTIVE_INVITES = 20;

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

export async function updateGroupDetails(slug: string, formData: FormData) {
  const { group, role } = await requireMember(slug);
  if (role !== "owner") {
    throw new Error("Only the owner can edit group details.");
  }

  const description =
    String(formData.get("description") ?? "").trim().slice(0, 280) || null;

  const coverRaw = String(formData.get("coverUrl") ?? "").trim();
  let coverUrl: string | null = null;
  if (coverRaw) {
    let parsed: URL;
    try {
      parsed = new URL(coverRaw);
    } catch {
      throw new Error("Cover image URL must be a valid URL.");
    }
    // img-src in the CSP only allows https:, so an http cover would silently break.
    if (parsed.protocol !== "https:") {
      throw new Error("Cover image URL must start with https://");
    }
    coverUrl = parsed.toString();
  }

  await db
    .update(groups)
    .set({ description, coverUrl })
    .where(eq(groups.id, group.id));

  revalidatePath(`/groups/${slug}`);
  revalidatePath(`/groups/${slug}/settings`);
}

export async function pinPost(slug: string, postId: string) {
  const { group, role } = await requireMember(slug);
  if (role !== "owner") throw new Error("Only the owner can pin posts.");
  if (!(await postInGroup(postId, group.id))) notFound();
  await db.update(posts).set({ pinnedAt: new Date() }).where(eq(posts.id, postId));
  revalidatePath(`/groups/${slug}`);
  revalidatePath(`/groups/${slug}/p/${postId}`);
}

export async function unpinPost(slug: string, postId: string) {
  const { group, role } = await requireMember(slug);
  if (role !== "owner") throw new Error("Only the owner can unpin posts.");
  if (!(await postInGroup(postId, group.id))) notFound();
  await db.update(posts).set({ pinnedAt: null }).where(eq(posts.id, postId));
  revalidatePath(`/groups/${slug}`);
  revalidatePath(`/groups/${slug}/p/${postId}`);
}

/** Turn a draft into a live post. Author only. Fans out new_post notifications now. */
export async function publishDraft(slug: string, postId: string) {
  const { group, user } = await requireMember(slug);

  const [post] = await db
    .select({ authorId: posts.authorId, status: posts.status })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.groupId, group.id)))
    .limit(1);
  if (!post) notFound();
  if (post.authorId !== user.id) throw new Error("Only the author can publish this draft.");
  if (post.status !== "draft") {
    // Already live — nothing to do, just go to it.
    redirect(`/groups/${slug}/p/${postId}`);
  }

  await db
    .update(posts)
    .set({ status: "published", createdAt: new Date() })
    .where(eq(posts.id, postId));

  after(async () => {
    const groupMembers = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.groupId, group.id));
    await notify(
      groupMembers.map((member) => ({
        userId: member.userId,
        actorId: user.id,
        type: "new_post" as const,
        groupId: group.id,
        postId,
      })),
    );
  });

  revalidatePath(`/groups/${slug}`);
  redirect(`/groups/${slug}/p/${postId}`);
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
 * Lenient version of readPostFields for drafts: an empty title or body is fine (a draft
 * is unfinished by definition), only the max lengths and the URL shape are enforced.
 */
function readDraftFields(formData: FormData): PostFields {
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const body = String(formData.get("body") ?? "").trim().slice(0, 10_000);
  const rawUrl = String(formData.get("url") ?? "").trim();

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
    // NOT NULL column: an untitled draft still needs a placeholder to list under.
    title: title || "Untitled draft",
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
  const { group, user, role } = await requireMember(slug);
  if (role !== "owner") throw new Error("Only the owner can invite people.");
  const now = new Date();

  if (
    !(await allow(
      `invite-create:${user.id}`,
      INVITE_CREATE_LIMIT.max,
      INVITE_CREATE_LIMIT.windowSeconds,
    ))
  ) {
    throw new Error("You have created several invites recently. Try again later.");
  }

  await db.transaction(async (tx) => {
    // Lock the group so simultaneous requests cannot race the active-invite ceiling.
    await tx
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, group.id))
      .for("update");

    // Expired and revoked tokens no longer carry product value. Removing them here
    // keeps the durable invite table bounded rather than merely hiding old rows.
    await tx.delete(invites).where(
      and(
        eq(invites.groupId, group.id),
        or(isNotNull(invites.revokedAt), lte(invites.expiresAt, now)),
      ),
    );

    const [{ total }] = await tx
      .select({ total: count() })
      .from(invites)
      .where(eq(invites.groupId, group.id));
    if (total >= MAX_ACTIVE_INVITES) {
      throw new Error(
        `This group already has ${MAX_ACTIVE_INVITES} active invites. Revoke one first.`,
      );
    }

    await tx.insert(invites).values({
      token: randomBytes(24).toString("base64url"),
      groupId: group.id,
      createdBy: user.id,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    });
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
  const isDraft = String(formData.get("intent") ?? "") === "draft";

  // A draft is a half-thought — it must save even with an empty title or body. Only a
  // publish goes through the strict field validation.
  const fields = isDraft ? readDraftFields(formData) : readPostFields(formData);
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
      status: isDraft ? "draft" : "published",
    })
    .returning({ id: posts.id });

  if (
    fields.url &&
    (await allow(
      `preview:${user.id}`,
      PREVIEW_LIMIT.max,
      PREVIEW_LIMIT.windowSeconds,
    ))
  ) {
    attachPreview(newPost.id, fields.url);
  }

  // A draft is private to its author: no feed, no notifications. Send them to the
  // drafts list to keep working.
  if (isDraft) {
    revalidatePath(`/groups/${slug}/drafts`);
    redirect(`/groups/${slug}/drafts`);
  }

  // Notify every other member that a new post landed. One row per member — fine at the
  // 50-member group ceiling. # ponytail: per-member fan-out, batch/digest if groups grow.
  after(async () => {
    const members = await listGroupMembers(group.id);
    // Everyone gets the new-post ping; anyone named in the body also gets a mention.
    await notify(
      members.map((member) => ({
        userId: member.id,
        actorId: user.id,
        type: "new_post" as const,
        groupId: group.id,
        postId: newPost.id,
      })),
    );
    await notify(
      extractMentionIds(fields.body, members).map((id) => ({
        userId: id,
        actorId: user.id,
        type: "mention" as const,
        groupId: group.id,
        postId: newPost.id,
      })),
    );
  });

  revalidatePath(`/groups/${slug}`);
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
      // Never show metadata from the old URL while a new preview is pending or
      // deliberately skipped by the outbound-fetch limiter.
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      ogSite: null,
      ogFetchedAt: null,
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

  if (
    fields.url &&
    (await allow(
      `preview:${user.id}`,
      PREVIEW_LIMIT.max,
      PREVIEW_LIMIT.windowSeconds,
    ))
  ) {
    attachPreview(updated.id, fields.url);
  }
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

  // Fetch the post (scoped to this group) to get its author for the notification —
  // this doubles as the in-group check that postInGroup used to do.
  const [post] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.groupId, group.id)))
    .limit(1);
  if (!post) notFound();

  const [comment] = await db
    .insert(comments)
    .values({ postId, authorId: user.id, body })
    .returning({ id: comments.id });
  revalidatePath(`/groups/${slug}/p/${postId}`);

  await notify([
    {
      userId: post.authorId,
      actorId: user.id,
      type: "comment",
      groupId: group.id,
      postId,
      commentId: comment.id,
    },
  ]);

  // Mentions in the comment ping the named members. Deferred: best-effort, off the
  // critical path (the comment is already saved and revalidated).
  after(async () => {
    const members = await listGroupMembers(group.id);
    await notify(
      extractMentionIds(body, members).map((id) => ({
        userId: id,
        actorId: user.id,
        type: "mention" as const,
        groupId: group.id,
        postId,
        commentId: comment.id,
      })),
    );
  });
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

  const [post] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.groupId, group.id)))
    .limit(1);
  if (!post) notFound();

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
    // Only on add, never on remove — a toggle spammer shouldn't spam notifications.
    await notify([
      {
        userId: post.authorId,
        actorId: user.id,
        type: "reaction",
        groupId: group.id,
        postId,
      },
    ]);
  }

  revalidatePath(`/groups/${slug}/p/${postId}`);
}

export async function toggleCommentReaction(
  slug: string,
  postId: string,
  commentId: string,
  emoji: string,
) {
  const { group, user } = await requireMember(slug);

  if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
    throw new Error("Unsupported reaction.");
  }
  if (!isUuid(commentId) || !(await postInGroup(postId, group.id))) notFound();

  // The comment must belong to this post (which we just confirmed is in this group).
  const [comment] = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.postId, postId)))
    .limit(1);
  if (!comment) notFound();

  const existing = await db
    .select({ emoji: commentReactions.emoji })
    .from(commentReactions)
    .where(
      and(
        eq(commentReactions.commentId, commentId),
        eq(commentReactions.userId, user.id),
        eq(commentReactions.emoji, emoji),
      ),
    )
    .limit(1);

  if (existing.length) {
    await db
      .delete(commentReactions)
      .where(
        and(
          eq(commentReactions.commentId, commentId),
          eq(commentReactions.userId, user.id),
          eq(commentReactions.emoji, emoji),
        ),
      );
  } else {
    await db
      .insert(commentReactions)
      .values({ commentId, userId: user.id, emoji })
      .onConflictDoNothing();
  }

  revalidatePath(`/groups/${slug}/p/${postId}`);
}
