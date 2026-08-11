"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import {
  collectionPostAnnotations,
  collectionPosts,
  collections,
  posts,
} from "@/db/schema";
import { requireMember } from "@/lib/guard";
import { isUuid } from "@/lib/post";
import { allow } from "@/lib/rate-limit";

export type CollectionAnnotationState = { error: string | null; saved: boolean };

const ANNOTATION_LIMIT = { max: 30, windowSeconds: 60 };

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
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.groupId, groupId),
        eq(posts.status, "published"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * An annotation belongs to a collection item, not merely a collection and post that
 * happen to be in the same group. This also keeps an annotation from being added
 * after its post has been removed from the collection.
 */
async function collectionItemInGroup(
  collectionId: string,
  postId: string,
  groupId: string,
) {
  if (!isUuid(collectionId) || !isUuid(postId)) return false;

  const [row] = await db
    .select({ collectionId: collectionPosts.collectionId })
    .from(collectionPosts)
    .innerJoin(collections, eq(collections.id, collectionPosts.collectionId))
    .innerJoin(posts, eq(posts.id, collectionPosts.postId))
    .where(
      and(
        eq(collectionPosts.collectionId, collectionId),
        eq(collectionPosts.postId, postId),
        eq(collections.groupId, groupId),
        eq(posts.groupId, groupId),
        eq(posts.status, "published"),
      ),
    )
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
  if (!(await collectionItemInGroup(collectionId, postId, group.id))) notFound();
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

/** Create or replace the current member's one plain-text note on this collection item. */
export async function saveCollectionAnnotation(
  slug: string,
  collectionId: string,
  postId: string,
  formData: FormData,
): Promise<CollectionAnnotationState> {
  const { group, user } = await requireMember(slug);
  if (!(await collectionItemInGroup(collectionId, postId, group.id))) notFound();

  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 1 || body.length > 500) {
    return { error: "Note must be between 1 and 500 characters.", saved: false };
  }
  if (
    !(await allow(
      `collection-annotation:${user.id}`,
      ANNOTATION_LIMIT.max,
      ANNOTATION_LIMIT.windowSeconds,
    ))
  ) {
    return {
      error: "You are adding notes very fast. Wait a moment and try again.",
      saved: false,
    };
  }

  await db
    .insert(collectionPostAnnotations)
    .values({ collectionId, postId, authorId: user.id, body })
    .onConflictDoUpdate({
      target: [
        collectionPostAnnotations.collectionId,
        collectionPostAnnotations.postId,
        collectionPostAnnotations.authorId,
      ],
      set: { body, updatedAt: new Date() },
    });

  revalidatePath(`/groups/${slug}/collections/${collectionId}`);
  return { error: null, saved: true };
}

/** Authors delete their own notes; group owners may remove any note for moderation. */
export async function deleteCollectionAnnotation(
  slug: string,
  collectionId: string,
  postId: string,
  authorId: string,
) {
  const { group, user, role } = await requireMember(slug);
  if (!isUuid(authorId)) notFound();
  if (!(await collectionItemInGroup(collectionId, postId, group.id))) notFound();

  const [deleted] = await db
    .delete(collectionPostAnnotations)
    .where(
      and(
        eq(collectionPostAnnotations.collectionId, collectionId),
        eq(collectionPostAnnotations.postId, postId),
        eq(collectionPostAnnotations.authorId, authorId),
        role === "owner"
          ? undefined
          : eq(collectionPostAnnotations.authorId, user.id),
      ),
    )
    .returning({ authorId: collectionPostAnnotations.authorId });
  if (!deleted) notFound();

  revalidatePath(`/groups/${slug}/collections/${collectionId}`);
}
