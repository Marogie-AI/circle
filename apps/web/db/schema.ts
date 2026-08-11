export * from "./auth-schema";

import { desc, sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  coverUrl: text("cover_url"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index("memberships_user_id_idx").on(table.userId),
  ],
);

export const invites = pgTable(
  "invites",
  {
    token: text("token").primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [index("invites_group_id_idx").on(table.groupId)],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url"),
    tags: text("tags").array().notNull().default([]),
    // 'published' | 'draft'. Drafts are visible only to their author, never in the feed.
    status: text("status").notNull().default("published"),
    // Owner-pinned posts sort to the top of the feed. Null = not pinned.
    pinnedAt: timestamp("pinned_at"),
    // Open Graph metadata for the link card. Nullable: a preview is best-effort and
    // must never block or fail posting. ogFetchedAt records that we tried.
    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    ogImage: text("og_image"),
    ogSite: text("og_site"),
    ogFetchedAt: timestamp("og_fetched_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("posts_group_feed_idx").on(
      table.groupId,
      desc(table.createdAt),
      desc(table.id),
    ),
    index("posts_tags_idx").using("gin", table.tags),
    // Trigram index on title, so searchGroupPosts can actually use an index.
    //
    // Its predicate is `search_vector @@ tsquery OR title ILIKE '%q%'`. A leading-wildcard
    // ILIKE is unindexable by btree, and one unindexable arm of an OR forces a sequential
    // scan of the WHOLE predicate — so posts_search_idx, though perfectly good, was never
    // reached. Measured on a 50k-post group: 122ms parallel seq scan for a term with no
    // matches, versus 0.25ms once this exists, because the planner can finally BitmapOr
    // the two GIN indexes together. Costs ~7MB per 150k posts. The query is unchanged.
    index("posts_title_trgm_idx").using(
      "gin",
      sql`${table.title} gin_trgm_ops`,
    ),
    // The author filter on the feed sorts by the same keys as the feed itself. Without
    // this, filtering a busy group to one infrequent poster scans most of the group.
    index("posts_group_author_feed_idx").on(
      table.groupId,
      table.authorId,
      desc(table.createdAt),
      desc(table.id),
    ),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("comments_post_id_created_at_idx").on(
      table.postId,
      table.createdAt,
    ),
  ],
);

export const reactions = pgTable(
  "reactions",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId, table.emoji] }),
  ],
);

/**
 * In-app notifications. One row per (recipient, event). `type` is
 * 'comment' | 'reaction' | 'new_post' | 'mention'. postId/commentId are nullable so the
 * row can point at whatever the event is about. readAt null = unread (partial index).
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => comments.id, {
      onDelete: "cascade",
    }),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId, desc(table.createdAt)),
    index("notifications_user_unread_idx")
      .on(table.userId)
      .where(sql`${table.readAt} is null`),
  ],
);

/** Emoji reactions on comments — mirrors `reactions`, keyed on the comment instead. */
export const commentReactions = pgTable(
  "comment_reactions",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId, table.emoji] }),
  ],
);

/**
 * Fixed-window rate limit counters.
 *
 * In Postgres rather than memory because serverless instances do not share memory — an
 * in-process Map would reset on every cold start and would be per-instance, so Vercel
 * spinning up more instances under load defeats exactly the limit you wanted. This costs
 * one extra round-trip on paths that already talk to Postgres.
 *
 * `key` encodes scope and subject, e.g. "post:<userId>" or "mobile:<userId>".
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

/** Per-member "I have seen this group up to here", drives the unread badges. */
export const groupReads = pgTable(
  "group_reads",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.userId] })],
);

/**
 * Named folders for saved posts. `groupId` null = a personal folder (filed via
 * saved_posts.collection_id). `groupId` set = a SHARED collection: visible to every
 * member of that group, and any member can add the group's posts to it via
 * collection_posts. `userId` is always the creator.
 */
export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("collections_user_idx").on(table.userId),
    index("collections_group_idx").on(table.groupId),
  ],
);

/** Posts filed into a SHARED (group) collection — contributed by any member. */
export const collectionPosts = pgTable(
  "collection_posts",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    addedBy: text("added_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.postId] }),
    index("collection_posts_collection_idx").on(
      table.collectionId,
      desc(table.createdAt),
    ),
  ],
);

/**
 * A member's plain-text rationale for one post in a shared collection. The composite
 * foreign key means an annotation cannot outlive the collection item it explains.
 */
export const collectionPostAnnotations = pgTable(
  "collection_post_annotations",
  {
    collectionId: uuid("collection_id").notNull(),
    postId: uuid("post_id").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.postId, table.authorId] }),
    foreignKey({
      columns: [table.collectionId, table.postId],
      foreignColumns: [collectionPosts.collectionId, collectionPosts.postId],
      name: "collection_post_annotations_collection_post_fk",
    }).onDelete("cascade"),
    index("collection_post_annotations_collection_post_updated_idx").on(
      table.collectionId,
      table.postId,
      desc(table.updatedAt),
    ),
  ],
);

/**
 * Personal bookmarks. Note the read path must always re-join memberships: a row here
 * outliving the user's membership must NOT keep the post visible in /saved.
 */
export const savedPosts = pgTable(
  "saved_posts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    // Which folder this bookmark lives in. Null = unfiled. Set-null on delete so
    // deleting a collection keeps the bookmarks, just unfiles them.
    collectionId: uuid("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),
    // Read-later state. readAt null = unread. archivedAt null = active. Two independent
    // facts, so unarchiving restores the prior read/unread state.
    readAt: timestamp("read_at"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.postId] }),
    index("saved_posts_user_idx").on(table.userId, desc(table.createdAt)),
  ],
);
