"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { savedPosts } from "@/db/schema";
import { requireMember } from "@/lib/guard";
import { isUuid } from "@/lib/post";
import { isSaved } from "@/lib/queries/saved";

/**
 * Toggle a bookmark. Takes the group slug and goes through requireMember, so you can
 * only ever bookmark a post in a group you belong to — a raw postId alone would let
 * anyone bookmark (and thereby read the title of) any post in the system.
 */
export async function toggleSaved(slug: string, postId: string) {
  const { group, user } = await requireMember(slug);
  if (!isUuid(postId)) notFound();

  // confirm the post really is in the group we just authorised against
  const { posts } = await import("@/db/schema");
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.groupId, group.id)))
    .limit(1);
  if (!post) notFound();

  if (await isSaved(user.id, postId)) {
    await db
      .delete(savedPosts)
      .where(and(eq(savedPosts.userId, user.id), eq(savedPosts.postId, postId)));
  } else {
    await db
      .insert(savedPosts)
      .values({ userId: user.id, postId })
      .onConflictDoNothing();
  }

  revalidatePath(`/groups/${slug}`);
  revalidatePath(`/groups/${slug}/p/${postId}`);
  revalidatePath("/saved");
}
