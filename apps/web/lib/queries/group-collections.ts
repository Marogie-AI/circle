import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  collectionPostAnnotations,
  collectionPosts,
  collections,
  posts,
  user,
} from "@/db/schema";

/** Shared collections in a group, with how many posts each holds. */
export async function listGroupCollections(groupId: string) {
  return db
    .select({
      id: collections.id,
      name: collections.name,
      count: sql<number>`count(${collectionPosts.postId})::int`,
    })
    .from(collections)
    .leftJoin(
      collectionPosts,
      eq(collectionPosts.collectionId, collections.id),
    )
    .where(eq(collections.groupId, groupId))
    .groupBy(collections.id, collections.name, collections.createdAt)
    .orderBy(desc(collections.createdAt));
}

/** A single shared collection, scoped to its group (returns undefined if it isn't in it). */
export async function getGroupCollection(id: string, groupId: string) {
  const [collection] = await db
    .select({ id: collections.id, name: collections.name, createdBy: collections.userId })
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.groupId, groupId)))
    .limit(1);
  return collection;
}

/** Published posts filed into a shared collection, newest addition first. */
export async function listCollectionPosts(collectionId: string) {
  return db
    .select({
      id: posts.id,
      title: posts.title,
      createdAt: posts.createdAt,
      authorName: user.name,
      ogImage: posts.ogImage,
    })
    .from(collectionPosts)
    .innerJoin(posts, eq(posts.id, collectionPosts.postId))
    .innerJoin(user, eq(user.id, posts.authorId))
    .where(
      and(
        eq(collectionPosts.collectionId, collectionId),
        eq(posts.status, "published"),
      ),
    )
    .orderBy(desc(collectionPosts.createdAt));
}

/**
 * Member notes for the items in one shared collection. The caller has already scoped
 * the collection through requireMember/getGroupCollection before rendering these.
 */
export async function listCollectionPostAnnotations(collectionId: string) {
  return db
    .select({
      collectionId: collectionPostAnnotations.collectionId,
      postId: collectionPostAnnotations.postId,
      authorId: collectionPostAnnotations.authorId,
      authorName: user.name,
      body: collectionPostAnnotations.body,
      createdAt: collectionPostAnnotations.createdAt,
      updatedAt: collectionPostAnnotations.updatedAt,
    })
    .from(collectionPostAnnotations)
    .innerJoin(user, eq(user.id, collectionPostAnnotations.authorId))
    .where(eq(collectionPostAnnotations.collectionId, collectionId))
    .orderBy(
      desc(collectionPostAnnotations.updatedAt),
      desc(collectionPostAnnotations.authorId),
    );
}
