"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { collections, savedPosts } from "@/db/schema";
import { requireMember, requireSession } from "@/lib/guard";
import { isUuid } from "@/lib/post";
import { isSaved } from "@/lib/queries/saved";

/** Read-later state changes — each scoped to the caller's own saved row. */
async function updateSavedState(
  postId: string,
  patch: { readAt?: Date | null; archivedAt?: Date | null },
) {
  const session = await requireSession();
  if (!isUuid(postId)) notFound();
  await db
    .update(savedPosts)
    .set(patch)
    .where(
      and(eq(savedPosts.userId, session.user.id), eq(savedPosts.postId, postId)),
    );
  revalidatePath("/saved");
}

export async function markSavedRead(postId: string) {
  await updateSavedState(postId, { readAt: new Date() });
}
export async function markSavedUnread(postId: string) {
  await updateSavedState(postId, { readAt: null });
}
// Archiving leaves read_at untouched, so unarchive restores the prior read/unread state.
export async function archiveSavedPost(postId: string) {
  await updateSavedState(postId, { archivedAt: new Date() });
}
export async function unarchiveSavedPost(postId: string) {
  await updateSavedState(postId, { archivedAt: null });
}

export async function createCollection(formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim().slice(0, 50);
  if (name.length < 1) throw new Error("Collection needs a name.");
  await db.insert(collections).values({ userId: session.user.id, name });
  revalidatePath("/saved");
}

export async function deleteCollection(id: string) {
  const session = await requireSession();
  if (!isUuid(id)) notFound();
  // Scoped to the caller; deleting sets saved_posts.collection_id to null (bookmarks stay).
  await db
    .delete(collections)
    .where(
      and(
        eq(collections.id, id),
        eq(collections.userId, session.user.id),
        isNull(collections.groupId),
      ),
    );
  revalidatePath("/saved");
}

/** File a saved post into a collection, or pass an empty id to unfile it. */
export async function setSavedCollection(postId: string, collectionId: string) {
  const session = await requireSession();
  if (!isUuid(postId)) notFound();

  let target: string | null = null;
  if (collectionId) {
    if (!isUuid(collectionId)) notFound();
    // The collection must be the caller's personal folder — never trust the posted id
    // or allow a shared group collection to be used by the private saved-posts model.
    const [owned] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          eq(collections.id, collectionId),
          eq(collections.userId, session.user.id),
          isNull(collections.groupId),
        ),
      )
      .limit(1);
    if (!owned) notFound();
    target = collectionId;
  }

  await db
    .update(savedPosts)
    .set({ collectionId: target })
    .where(
      and(eq(savedPosts.userId, session.user.id), eq(savedPosts.postId, postId)),
    );
  revalidatePath("/saved");
}

/**
 * Toggle a bookmark. Takes the group slug and goes through requireMember, so you can
 * only ever bookmark a post in a group you belong to — a raw postId alone would let
 * anyone bookmark (and thereby read the title of) any post in the system.
 */
export async function toggleSaved(slug: string, postId: string) {
  const { group, user } = await requireMember(slug);
  if (!isUuid(postId)) notFound();

  // Confirm the post really is published in the group we just authorised against. A raw
  // postId alone would otherwise let a member bookmark an author-private draft.
  const { posts } = await import("@/db/schema");
  const [post] = await db
    .select({ id: posts.id })
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
