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
import { DEFAULT_POST_KIND, parsePostKind, type PostKind } from "@/lib/kind";
import { extractMentionIds } from "@/lib/mentions";
import { notify } from "@/lib/notify";
import { isUuid, REACTION_EMOJIS } from "@/lib/post";
import { listGroupMembers } from "@/lib/queries/groups";
import { listReplies, listRootComments } from "@/lib/queries/comments";
import { allow } from "@/lib/rate-limit";
import {
  fetchStockImage,
  stockImagesEnabled,
  stockKeywords,
} from "@/lib/stock-image";

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
  if (!(await publishedPostInGroup(postId, group.id))) notFound();
  await db.update(posts).set({ pinnedAt: new Date() }).where(eq(posts.id, postId));
  revalidatePath(`/groups/${slug}`);
  revalidatePath(`/groups/${slug}/p/${postId}`);
}

export async function unpinPost(slug: string, postId: string) {
  const { group, role } = await requireMember(slug);
  if (role !== "owner") throw new Error("Only the owner can unpin posts.");
  if (!(await publishedPostInGroup(postId, group.id))) notFound();
  await db.update(posts).set({ pinnedAt: null }).where(eq(posts.id, postId));
  revalidatePath(`/groups/${slug}`);
  revalidatePath(`/groups/${slug}/p/${postId}`);
}

/** Turn a draft into a live post. Author only. Fans out new_post notifications now. */
export async function publishDraft(slug: string, postId: string) {
  const { group, user } = await requireMember(slug);

  const [post] = await db
    .select({
      authorId: posts.authorId,
      status: posts.status,
      // Needed to fetch the preview and cover below, which a draft deliberately skipped.
      url: posts.url,
      title: posts.title,
      tags: posts.tags,
      coverFetchedAt: posts.coverFetchedAt,
      ogFetchedAt: posts.ogFetchedAt,
    })
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

  // This is where a draft's outbound fetches finally happen. createPost and updatePost
  // skip them while a post is unpublished, so publishing is the first moment the linked
  // page or Openverse is allowed to learn anything about it. Guarded on *FetchedAt so
  // re-publishing an already-fetched post does not fetch twice.
  if (
    !post.ogFetchedAt &&
    !post.coverFetchedAt &&
    (await allow(
      `preview:${user.id}`,
      PREVIEW_LIMIT.max,
      PREVIEW_LIMIT.windowSeconds,
    ))
  ) {
    if (post.url) {
      attachPreview(postId, post.url, post.title, post.tags);
    } else {
      after(() => attachStockCover(postId, post.title, post.tags));
    }
  }

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

/** A group member may interact only with posts that are visible to the group. */
async function publishedPostInGroup(postId: string, groupId: string) {
  if (!isUuid(postId)) return false;

  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.groupId, groupId),
        eq(posts.status, "published"),
      ),
    )
    .limit(1);

  return Boolean(post);
}

type PostFields =
  | {
      ok: true;
      title: string;
      body: string;
      url: string | null;
      tags: string[];
      kind: PostKind;
    }
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
    // An unknown kind is not worth an error message — it can only come from a tampered
    // form, never from the select. Fall back rather than block the post.
    kind: parsePostKind(formData.get("kind")) ?? DEFAULT_POST_KIND,
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
    kind: parsePostKind(formData.get("kind")) ?? DEFAULT_POST_KIND,
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
function attachPreview(
  postId: string,
  url: string | null,
  title: string,
  tags: string[],
) {
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

    // The linked page had no artwork of its own — fall back to a stock cover.
    if (!preview?.image) await attachStockCover(postId, title, tags);
  });
}

/**
 * Fetch a stock cover and store it with its credit. Runs in `after()` like the preview:
 * an outbound request must never be on the path of saving a post.
 *
 * PRIVACY: this sends keywords derived from the post to Openverse. `stockKeywords` decides
 * what those are — read it before changing anything here. Set STOCK_IMAGES_DISABLED=1 to
 * stop all outbound cover requests.
 */
async function attachStockCover(
  postId: string,
  title: string,
  tags: string[],
) {
  if (!stockImagesEnabled()) return;

  const query = stockKeywords(title, tags);
  // Stamped even when there is nothing to send or nothing found, so a post with no usable
  // keywords is not re-queried on every publish. One UPDATE either way — the write is the
  // point, not a side effect of a request that did not happen.
  const image = query ? await fetchStockImage(query) : null;
  await db
    .update(posts)
    .set({
      coverUrl: image?.url ?? null,
      coverAuthorName: image?.authorName ?? null,
      coverAuthorUrl: image?.authorUrl ?? null,
      coverLicenseName: image?.licenseName ?? null,
      coverLicenseUrl: image?.licenseUrl ?? null,
      coverFetchedAt: new Date(),
    })
    .where(eq(posts.id, postId));
}

/**
 * Post mutations are allowed for the author, or for the group owner when the post is
 * published. Drafts remain author-private even from owners. Returned as an extra
 * predicate so it lands INSIDE the mutation's own WHERE clause.
 */
function authorOrOwnerOfPublishedPost(role: string, userId: string) {
  return role === "owner"
    ? or(eq(posts.authorId, userId), eq(posts.status, "published"))
    : eq(posts.authorId, userId);
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
  const { group, role } = await requireMember(slug);
  if (role !== "owner") throw new Error("Only the owner can revoke invites.");

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
      kind: fields.kind,
      status: isDraft ? "draft" : "published",
    })
    .returning({ id: posts.id });

  // A draft is private to its author: no feed, no notifications, and — because this
  // returns BEFORE the fetch block below — no outbound requests either. A draft is
  // unpublished by definition, so neither the linked page nor Openverse should learn
  // anything about it until the author decides to publish. publishDraft does the
  // fetching instead.
  if (isDraft) {
    revalidatePath(`/groups/${slug}/drafts`);
    redirect(`/groups/${slug}/drafts`);
  }

  // The same limiter covers both outbound fetches: they are one budget of "requests this
  // member can make us send to other people's servers".
  if (
    await allow(
      `preview:${user.id}`,
      PREVIEW_LIMIT.max,
      PREVIEW_LIMIT.windowSeconds,
    )
  ) {
    if (fields.url) {
      // attachPreview falls through to a stock cover if the page has no image.
      attachPreview(newPost.id, fields.url, fields.title, fields.tags);
    } else {
      // No link at all — a note. Nothing to preview, so go straight to a cover.
      after(() => attachStockCover(newPost.id, fields.title, fields.tags));
    }
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
  if (!isUuid(postId)) notFound();

  // A draft may remain incomplete while its author works on it. Reading the status here
  // chooses the validator; matching it again in the UPDATE below prevents a concurrent
  // publish from letting lenient draft validation overwrite a live post.
  const [current] = await db
    .select({ status: posts.status })
    .from(posts)
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.groupId, group.id),
        authorOrOwnerOfPublishedPost(role, user.id),
      ),
    )
    .limit(1);
  if (!current) notFound();

  const fields =
    current.status === "draft" ? readDraftFields(formData) : readPostFields(formData);
  if (!fields.ok) return { error: fields.error };

  const [updated] = await db
    .update(posts)
    .set({
      title: fields.title,
      body: fields.body,
      url: fields.url,
      tags: fields.tags,
      kind: fields.kind,
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
        eq(posts.status, current.status),
        authorOrOwnerOfPublishedPost(role, user.id),
      ),
    )
    .returning({ id: posts.id, url: posts.url });

  // no row matched => not this group's post, or not yours to edit. Same 404 either way.
  if (!updated) notFound();

  // Same rule as createPost: an unpublished draft causes no outbound request, however
  // many times it is edited. current.status is the row's status before this update, and
  // updatePost never changes it — publishing goes through publishDraft.
  if (
    current.status !== "draft" &&
    (await allow(
      `preview:${user.id}`,
      PREVIEW_LIMIT.max,
      PREVIEW_LIMIT.windowSeconds,
    ))
  ) {
    if (fields.url) {
      attachPreview(updated.id, fields.url, fields.title, fields.tags);
    } else {
      after(() => attachStockCover(updated.id, fields.title, fields.tags));
    }
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
        authorOrOwnerOfPublishedPost(role, user.id),
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
  if (!(await publishedPostInGroup(postId, group.id))) notFound();

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
  if (!(await publishedPostInGroup(postId, group.id))) notFound();

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
  // No revalidatePath: the client thread removes just this node (and its subtree) in place.
  // Revalidating would refetch and re-render the whole comment tree, collapsing every
  // thread the viewer had expanded — exactly what we don't want on a single delete.
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

  // Fetch a published post (scoped to this group) to get its author for the
  // notification. Drafts are private to their author and cannot be commented on.
  const [post] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.groupId, group.id),
        eq(posts.status, "published"),
      ),
    )
    .limit(1);
  if (!post) notFound();

  // Optional reply target. Threads are an arbitrary-depth tree: parentId points at the
  // exact comment being replied to (no coercion). Scoping to postId keeps a reply from
  // being grafted onto another post's thread — that is the security boundary.
  const rawParent = String(formData.get("parentId") ?? "");
  let parent: { id: string; authorId: string } | undefined;
  if (rawParent) {
    if (!isUuid(rawParent)) notFound();
    const [row] = await db
      .select({ id: comments.id, authorId: comments.authorId })
      .from(comments)
      .where(and(eq(comments.id, rawParent), eq(comments.postId, postId)))
      .limit(1);
    if (!row) notFound();
    parent = { id: row.id, authorId: row.authorId };
  }

  const [comment] = await db
    .insert(comments)
    .values({ postId, authorId: user.id, body, parentId: parent?.id ?? null })
    .returning({ id: comments.id, createdAt: comments.createdAt });
  revalidatePath(`/groups/${slug}/p/${postId}`);

  // Notifications are best-effort, off the critical path: a database failure after the
  // comment was committed must not make the user retry and create duplicate content.
  after(async () => {
    // A reply pings the comment it answers ("reply"); a top-level comment pings the post
    // author ("comment"). notify() drops self-notifications on its own.
    await notify([
      parent
        ? {
            userId: parent.authorId,
            actorId: user.id,
            type: "reply" as const,
            groupId: group.id,
            postId,
            commentId: comment.id,
          }
        : {
            userId: post.authorId,
            actorId: user.id,
            type: "comment" as const,
            groupId: group.id,
            postId,
            commentId: comment.id,
          },
    ]);
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

  // Returned so a client thread can optimistically append the new reply without refetching
  // the whole level. New node: zero likes, zero replies, not yet liked by anyone.
  return {
    id: comment.id,
    body,
    createdAt: comment.createdAt,
    authorId: user.id,
    authorName: user.name,
    parentId: parent?.id ?? null,
    likeCount: 0,
    liked: false,
    replyCount: 0,
  };
}

/**
 * A page of a comment's direct replies, hydrated for the client thread to append. Auth is
 * re-checked here (never trust the client-passed group scope); the query itself is scoped to
 * postId so a member can't read replies from a post outside this group.
 */
export async function loadReplies(
  slug: string,
  postId: string,
  parentId: string,
  cursor: string | null,
) {
  const { group, user } = await requireMember(slug);
  if (!isUuid(parentId)) notFound();
  if (!(await publishedPostInGroup(postId, group.id))) notFound();
  return listReplies(postId, parentId, cursor, user.id);
}

/** A page of top-level comments for the client section's "Load more comments". */
export async function loadRootComments(
  slug: string,
  postId: string,
  cursor: string | null,
) {
  const { group, user } = await requireMember(slug);
  if (!(await publishedPostInGroup(postId, group.id))) notFound();
  return listRootComments(postId, cursor, user.id);
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
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.groupId, group.id),
        eq(posts.status, "published"),
      ),
    )
    .limit(1);
  if (!post) notFound();

  // Matched on (post, user) WITHOUT the emoji: a like means "this member has reacted",
  // whatever glyph they used. So an old 🔥 row reads as already liked and cannot be
  // liked again, and un-liking clears whatever they had rather than leaving a stray
  // legacy row behind that would keep them counted. See LIKE_EMOJI in lib/post.ts.
  const existing = await db
    .select({ emoji: reactions.emoji })
    .from(reactions)
    .where(and(eq(reactions.postId, postId), eq(reactions.userId, user.id)))
    .limit(1);

  if (existing.length) {
    await db
      .delete(reactions)
      .where(and(eq(reactions.postId, postId), eq(reactions.userId, user.id)));
  } else {
    await db
      .insert(reactions)
      .values({ postId, userId: user.id, emoji })
      .onConflictDoNothing();
    // Only on add, never on remove — a toggle spammer shouldn't spam notifications.
    after(async () => {
      await notify([
        {
          userId: post.authorId,
          actorId: user.id,
          type: "reaction",
          groupId: group.id,
          postId,
        },
      ]);
    });
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
  if (!isUuid(commentId) || !(await publishedPostInGroup(postId, group.id))) notFound();

  // The comment must belong to this post (which we just confirmed is in this group).
  const [comment] = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.postId, postId)))
    .limit(1);
  if (!comment) notFound();

  // Same (comment, user) matching as toggleReaction — one like per member per comment.
  const existing = await db
    .select({ emoji: commentReactions.emoji })
    .from(commentReactions)
    .where(
      and(
        eq(commentReactions.commentId, commentId),
        eq(commentReactions.userId, user.id),
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
        ),
      );
  } else {
    await db
      .insert(commentReactions)
      .values({ commentId, userId: user.id, emoji })
      .onConflictDoNothing();
  }
  // No revalidatePath: the comment thread owns like state optimistically. Revalidating would
  // refetch the page without updating the client-held comment props — the "like reverts" bug.
}
