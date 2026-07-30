"use server";

import { requireSession } from "@/lib/guard";
import { searchMyPosts, type SearchHit } from "@/lib/queries/search";

/**
 * Cross-group search for the command palette.
 * The userId comes from the session, never from the caller, and searchMyPosts joins
 * memberships — so this can only ever return posts the caller is entitled to see.
 */
export async function paletteSearch(query: string): Promise<SearchHit[]> {
  const session = await requireSession();
  if (query.trim().length < 2) return [];
  return searchMyPosts({ userId: session.user.id, query, limit: 8 });
}
