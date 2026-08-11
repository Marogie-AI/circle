"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { collectionPosts, collections, posts } from "@/db/schema";
import { requireMember } from "@/lib/guard";
import { isUuid } from "@/lib/post";

async function collectionInGroup(collectionId: string, groupId: string) {
  if (!isUuid(collectionId)) return false;
  const [row] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.groupId, groupId)))
    .limit(1);
  return Boolean(row);
}

async function postInGroup(postId: string, groupId: string) {
  if (!isUuid(postId)) return false;
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.groupId, groupId)))
    .limit(1);
  return Boolean(row);
}

export async function createGroupCollection(slug: string, formData: FormData) {
  const { group, user } = await requireMember(slug);
  const name = String(formData.get("name") ?? "").trim().slice(0, 50);
  if (name.length < 1) throw new Error("Collection needs a name.");
  await db
    .insert(collections)
    .values({ userId: user.id, groupId: group.id, name });
  revalidatePath(`/groups/${slug}`);
}

export async function deleteGroupCollection(slug: string, collectionId: string) {
  const { group, user, role } = await requireMember(slug);
  if (!(await collectionInGroup(collectionId, group.id))) notFound();
  // Creator or group owner may delete.
  const [collection] = await db
    .select({ userId: collections.userId })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);
  if (collection.userId !== user.id && role !== "owner") {
    throw new Error("Only the creator or an owner can delete this collection.");
  }
  await db.delete(collections).where(eq(collections.id, collectionId));
  revalidatePath(`/groups/${slug}`);
  redirect(`/groups/${slug}`);
}

export async function addToCollection(
  slug: string,
  collectionId: string,
  postId: string,
) {
  const { group, user } = await requireMember(slug);
  if (!(await collectionInGroup(collectionId, group.id))) notFound();
  if (!(await postInGroup(postId, group.id))) notFound();
  await db
    .insert(collectionPosts)
    .values({ collectionId, postId, addedBy: user.id })
    .onConflictDoNothing();
  revalidatePath(`/groups/${slug}/collections/${collectionId}`);
  revalidatePath(`/groups/${slug}/p/${postId}`);
}

export async function removeFromCollection(
  slug: string,
  collectionId: string,
  postId: string,
) {
  const { group } = await requireMember(slug);
  if (!(await collectionInGroup(collectionId, group.id))) notFound();
  await db
    .delete(collectionPosts)
    .where(
      and(
        eq(collectionPosts.collectionId, collectionId),
        eq(collectionPosts.postId, postId),
      ),
    );
  revalidatePath(`/groups/${slug}/collections/${collectionId}`);
  revalidatePath(`/groups/${slug}/p/${postId}`);
}
