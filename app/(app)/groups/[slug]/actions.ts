"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { comments, invites, posts, reactions } from "@/db/schema";
import { requireMember } from "@/lib/guard";
import { isUuid, REACTION_EMOJIS } from "@/lib/post";

export type PostActionState = { error: string | null };

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
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const rawUrl = String(formData.get("url") ?? "").trim();

  if (title.length < 1 || title.length > 200) {
    return { error: "Title must be between 1 and 200 characters." };
  }
  if (body.length < 1 || body.length > 10_000) {
    return { error: "Body must be between 1 and 10,000 characters." };
  }

  let url: string | null = null;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { error: "Link must use http:// or https://." };
      }
      url = parsed.toString();
    } catch {
      return { error: "Enter a valid link, including http:// or https://." };
    }
  }

  const tags = normalizeTags(String(formData.get("tags") ?? ""));
  const [newPost] = await db
    .insert(posts)
    .values({
      groupId: group.id,
      authorId: user.id,
      title,
      body,
      url,
      tags,
    })
    .returning({ id: posts.id });

  redirect(`/groups/${slug}/p/${newPost.id}`);
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
