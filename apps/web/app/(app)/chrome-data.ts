import { cache } from "react";
import { listGroupsForUser } from "@/lib/queries/groups";
import { unreadNotificationCount } from "@/lib/queries/notifications";
import { unreadCounts } from "@/lib/queries/reads";

/**
 * Sidebar payload. The desktop rail and the mobile drawer live in different parts of
 * the tree and each suspend on their own, so both call this — cache() makes that one
 * set of queries per request instead of two.
 *
 * Tag facets used to be fetched here for the rail's tag list. That list now lives in
 * the feed's filter bar, which fetches its own, so the chrome is down to two queries.
 */
export const getChromeData = cache(async function getChromeData(userId: string) {
  const [groups, unread, unreadNotifications] = await Promise.all([
    listGroupsForUser(userId),
    unreadCounts(userId),
    unreadNotificationCount(userId),
  ]);

  return { groups, unread: Object.fromEntries(unread), unreadNotifications };
});
