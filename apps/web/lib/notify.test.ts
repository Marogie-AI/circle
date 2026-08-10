import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groups, notifications, user } from "@/db/schema";
import { notify } from "@/lib/notify";
import {
  listNotifications,
  markAllNotificationsRead,
  unreadNotificationCount,
} from "@/lib/queries/notifications";

/**
 * notify() must drop self-notifications (you never get pinged for your own action), and
 * the unread count / mark-read round trip must be consistent.
 */
test("notify drops self-rows; unread count and mark-read stay consistent", async () => {
  const suffix = randomUUID();
  const recipientId = `nt-recipient-${suffix}`;
  const actorId = `nt-actor-${suffix}`;
  const groupId = randomUUID();

  try {
    await db.insert(user).values([
      { id: recipientId, name: "Recipient", email: `nt-r-${suffix}@example.test` },
      { id: actorId, name: "Actor", email: `nt-a-${suffix}@example.test` },
    ]);
    await db.insert(groups).values({
      id: groupId,
      name: "Notify group",
      slug: `nt-group-${suffix}`,
      createdBy: actorId,
    });

    await notify([
      { userId: recipientId, actorId, type: "comment", groupId },
      // self-notification — must be dropped
      { userId: actorId, actorId, type: "comment", groupId },
    ]);

    assert.equal(
      await unreadNotificationCount(recipientId),
      1,
      "recipient has exactly one unread",
    );
    assert.equal(
      await unreadNotificationCount(actorId),
      0,
      "self-notification was dropped",
    );

    const items = await listNotifications(recipientId);
    assert.equal(items.length, 1);
    assert.equal(items[0].actorName, "Actor");
    assert.equal(items[0].type, "comment");
    assert.equal(items[0].groupName, "Notify group");
    assert.equal(items[0].readAt, null);

    await markAllNotificationsRead(recipientId);
    assert.equal(
      await unreadNotificationCount(recipientId),
      0,
      "mark-read clears the unread count",
    );
  } finally {
    await db
      .delete(notifications)
      .where(inArray(notifications.userId, [recipientId, actorId]));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(user).where(inArray(user.id, [recipientId, actorId]));
  }
});
