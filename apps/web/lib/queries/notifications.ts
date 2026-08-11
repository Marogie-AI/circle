import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, memberships, notifications, posts, user } from "@/db/schema";

export async function unreadNotificationCount(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .innerJoin(
      memberships,
      and(
        eq(memberships.groupId, notifications.groupId),
        eq(memberships.userId, userId),
      ),
    )
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
  return row?.count ?? 0;
}

export type NotificationItem = {
  id: string;
  type: string;
  createdAt: Date;
  readAt: Date | null;
  actorName: string;
  groupSlug: string;
  groupName: string;
  postId: string | null;
  commentId: string | null;
  postTitle: string | null;
};

export async function listNotifications(
  userId: string,
  limit = 30,
): Promise<NotificationItem[]> {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
      actorName: user.name,
      groupSlug: groups.slug,
      groupName: groups.name,
      postId: notifications.postId,
      commentId: notifications.commentId,
      postTitle: posts.title,
    })
    .from(notifications)
    .innerJoin(user, eq(user.id, notifications.actorId))
    .innerJoin(groups, eq(groups.id, notifications.groupId))
    .innerJoin(
      memberships,
      and(
        eq(memberships.groupId, notifications.groupId),
        eq(memberships.userId, userId),
      ),
    )
    .leftJoin(posts, eq(posts.id, notifications.postId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.max(1, Math.min(limit, 100)));
}

/** Marks every unread notification for the user as read. Returns nothing. */
export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
}
