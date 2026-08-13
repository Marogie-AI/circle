import { invalidate, k } from "@/lib/cache";

export const keys = {
  membership: (slug: string, userId: string) => k("m", slug, userId),

  /**
   * All user-scoped chrome belongs behind one key. Splitting avatar, navigation, and
   * counters into separately cached fragments would turn every page render into several
   * billed GETs; the coarser value costs one command and is invalidated as a unit.
   */
  userChrome: (userId: string) => k("u", userId, "chrome"),
  groupMembers: (groupId: string) => k("g", groupId, "members"),
  groupTags: (groupId: string) => k("g", groupId, "tags"),
  groupCollections: (groupId: string) => k("g", groupId, "collections"),
  groupPinned: (groupId: string) => k("g", groupId, "pinned"),
  groupFeedFirst: (groupId: string, sort: string) => k("g", groupId, "feed1", sort),
};

export const invalidateGroupContent = (groupId: string) =>
  invalidate(
    keys.groupFeedFirst(groupId, "new"),
    keys.groupFeedFirst(groupId, "old"),
    keys.groupTags(groupId),
    keys.groupPinned(groupId),
  );

/** One variadic DEL clears every affected user's single chrome key. */
export const invalidateChromeFor = (userIds: string[]) =>
  invalidate(...userIds.map(keys.userChrome));
