import { db } from "@/db";
import { notifications } from "@/db/schema";

export type NotificationType = "comment" | "reaction" | "new_post" | "mention";

export type NotifyRow = {
  /** Recipient. */
  userId: string;
  /** Who caused the event. */
  actorId: string;
  type: NotificationType;
  groupId: string;
  postId?: string | null;
  commentId?: string | null;
};

/**
 * Bulk-insert notifications, dropping self-notifications (you never get pinged for your
 * own action). Best-effort: a failure here must never break the mutation that triggered
 * it, so callers should not await this on the critical path if it can be deferred.
 */
export async function notify(rows: NotifyRow[]) {
  const clean = rows.filter((row) => row.userId !== row.actorId);
  if (clean.length === 0) return;

  await db.insert(notifications).values(
    clean.map((row) => ({
      userId: row.userId,
      actorId: row.actorId,
      type: row.type,
      groupId: row.groupId,
      postId: row.postId ?? null,
      commentId: row.commentId ?? null,
    })),
  );
}
