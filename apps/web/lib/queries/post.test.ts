import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  comments,
  groups,
  memberships,
  posts,
  reactions,
  user,
} from "@/db/schema";
import { getFeedPage } from "@/lib/queries/feed";

type SeedPost = {
  id: string;
  groupId: string;
  authorId: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: Date;
};

// bun:test has no node:test-style subtests. `step` keeps each assertion group named
// in failure output while the whole test shares one seed and one cleanup block.
const step = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (error) {
    throw new Error(`${name} — ${(error as Error).message}`, { cause: error });
  }
};

test("feed stays scoped and paginates without gaps", async () => {
  const suffix = randomUUID();
  const ownerId = `feed-owner-${suffix}`;
  const groupId = randomUUID();
  const otherGroupId = randomUUID();
  const baseTime = new Date("2026-05-20T12:00:00.000Z");
  const sharedTime = new Date("2026-05-20T11:57:00.000Z");
  const seededPosts: SeedPost[] = [
    {
      id: randomUUID(),
      groupId,
      authorId: ownerId,
      title: "Newest engineering post",
      body: "One",
      tags: ["engineering", "tools"],
      createdAt: baseTime,
    },
    {
      id: randomUUID(),
      groupId,
      authorId: ownerId,
      title: "Books post",
      body: "Two",
      tags: ["books"],
      createdAt: new Date(baseTime.getTime() - 60_000),
    },
    {
      id: randomUUID(),
      groupId,
      authorId: ownerId,
      title: "Second engineering post",
      body: "Three",
      tags: ["engineering"],
      createdAt: new Date(baseTime.getTime() - 120_000),
    },
    ...Array.from({ length: 3 }, (_, index) => ({
      id: randomUUID(),
      groupId,
      authorId: ownerId,
      title: `Shared timestamp ${index}`,
      body: "Same time",
      tags: ["same-time"],
      createdAt: sharedTime,
    })),
    {
      id: randomUUID(),
      groupId,
      authorId: ownerId,
      title: "Oldest post",
      body: "Seven",
      tags: ["life"],
      createdAt: new Date(baseTime.getTime() - 300_000),
    },
  ];
  const otherPostId = randomUUID();

  try {
    await db.insert(user).values({
      id: ownerId,
      name: "Feed Owner",
      email: `feed-owner-${suffix}@example.test`,
    });
    await db.insert(groups).values([
      {
        id: groupId,
        name: "Feed group",
        slug: `feed-group-${suffix}`,
        createdBy: ownerId,
      },
      {
        id: otherGroupId,
        name: "Other feed group",
        slug: `other-feed-group-${suffix}`,
        createdBy: ownerId,
      },
    ]);
    await db.insert(posts).values([
      ...seededPosts,
      {
        id: otherPostId,
        groupId: otherGroupId,
        authorId: ownerId,
        title: "Must never leak",
        body: "Private to another group",
        tags: ["engineering"],
        createdAt: new Date(baseTime.getTime() + 60_000),
      },
    ]);

    await step("returns only the requested group's posts", async () => {
      const page = await getFeedPage({ groupId, limit: 20 });
      assert.equal(page.items.length, seededPosts.length);
      assert.ok(page.items.every((post) => post.id !== otherPostId));
    });

    await step("returns every post once in strict tuple order", async () => {
      const collected: typeof seededPosts = [];
      let cursor: string | null = null;

      do {
        const page = await getFeedPage({ groupId, cursor, limit: 3 });
        const byId = new Map(seededPosts.map((post) => [post.id, post]));
        for (const item of page.items) {
          const seeded = byId.get(item.id);
          assert.ok(seeded);
          collected.push(seeded);
        }
        cursor = page.nextCursor;
      } while (cursor);

      assert.equal(collected.length, seededPosts.length);
      assert.equal(new Set(collected.map((post) => post.id)).size, seededPosts.length);
      assert.deepEqual(
        new Set(collected.map((post) => post.id)),
        new Set(seededPosts.map((post) => post.id)),
      );
      for (let index = 1; index < collected.length; index += 1) {
        const previous = collected[index - 1];
        const current = collected[index];
        const strictlyDescending =
          previous.createdAt.getTime() > current.createdAt.getTime() ||
          (previous.createdAt.getTime() === current.createdAt.getTime() &&
            previous.id > current.id);
        assert.ok(strictlyDescending, "feed order must descend by (createdAt, id)");
      }
    });

    await step("does not skip posts with an identical createdAt", async () => {
      const firstPage = await getFeedPage({
        groupId,
        tag: "same-time",
        limit: 2,
      });
      assert.equal(firstPage.items.length, 2);
      assert.ok(firstPage.nextCursor);
      const secondPage = await getFeedPage({
        groupId,
        tag: "same-time",
        cursor: firstPage.nextCursor,
        limit: 2,
      });
      const ids = [...firstPage.items, ...secondPage.items].map((post) => post.id);
      assert.equal(ids.length, 3);
      assert.equal(new Set(ids).size, 3);
      assert.deepEqual(
        new Set(ids),
        new Set(
          seededPosts
            .filter((post) => post.tags.includes("same-time"))
            .map((post) => post.id),
        ),
      );
    });

    await step("filters by tag", async () => {
      const page = await getFeedPage({ groupId, tag: "engineering" });
      assert.equal(page.items.length, 2);
      assert.ok(page.items.every((post) => post.tags.includes("engineering")));
    });

    await step("treats a garbage cursor as page one", async () => {
      const [firstPage, garbagePage] = await Promise.all([
        getFeedPage({ groupId, limit: 3 }),
        getFeedPage({ groupId, cursor: "not-a-real-cursor", limit: 3 }),
      ]);
      assert.deepEqual(
        garbagePage.items.map((post) => post.id),
        firstPage.items.map((post) => post.id),
      );
    });
  } finally {
    await db.delete(reactions).where(
      inArray(reactions.postId, [...seededPosts.map((post) => post.id), otherPostId]),
    );
    await db.delete(comments).where(
      inArray(comments.postId, [...seededPosts.map((post) => post.id), otherPostId]),
    );
    await db.delete(posts).where(
      inArray(posts.id, [...seededPosts.map((post) => post.id), otherPostId]),
    );
    await db.delete(memberships).where(
      inArray(memberships.groupId, [groupId, otherGroupId]),
    );
    await db.delete(groups).where(inArray(groups.id, [groupId, otherGroupId]));
    await db.delete(user).where(eq(user.id, ownerId));
  }
});
