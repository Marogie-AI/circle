import { invalidate, k } from "@/lib/cache";

export const keys = {
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
    // Deleting a post cascades its collection memberships, changing these counts.
    keys.groupCollections(groupId),
  );

/** One variadic DEL clears every affected user's single chrome key. */
export const invalidateChromeFor = (userIds: string[]) =>
  invalidate(...userIds.map(keys.userChrome));

/** Membership changes affect the member picker plus each affected user's app chrome. */
export const invalidateGroupMembership = (groupId: string, userIds: string[]) =>
  invalidate(keys.groupMembers(groupId), ...userIds.map(keys.userChrome));

/**
 * A display name is copied into member pickers and the cached post byline projections.
 * Evict every affected group in one DEL so a rename cannot linger until several TTLs
 * expire, without also dropping unrelated tag or collection entries.
 */
export const invalidateDisplayNameForGroups = (groupIds: string[]) =>
  invalidate(
    ...groupIds.flatMap((groupId) => [
      keys.groupMembers(groupId),
      keys.groupFeedFirst(groupId, "new"),
      keys.groupFeedFirst(groupId, "old"),
      keys.groupPinned(groupId),
    ]),
  );
