export * from "./auth-schema";

import { desc } from "drizzle-orm";
import {
  index,
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.postId] }),
    index("saved_posts_user_idx").on(table.userId, desc(table.createdAt)),
  ],
);
