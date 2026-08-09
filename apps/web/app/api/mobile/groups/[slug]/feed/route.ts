import { apiMember } from "@/lib/api-auth";
import { getFeedPage, parseFeedSort } from "@/lib/queries/feed";

const FEED_LIMIT = 30;

/**
 * One keyset page of a group's feed.
 *
 * No input validation beyond this: getFeedPage clamps the limit and returns null for a
 * malformed cursor rather than throwing, and parseFeedSort coerces anything unknown to
 * "new". The limit is fixed rather than client-supplied — there is no reason to let a
 * client choose it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const member = await apiMember(request, slug);
  if ("error" in member) return member.error;

  const query = new URL(request.url).searchParams;
  const page = await getFeedPage({
    groupId: member.group.id,
    tag: query.get("tag"),
    sort: parseFeedSort(query.get("sort")),
    cursor: query.get("cursor"),
    limit: FEED_LIMIT,
  });

  // nextCursor === null is the end-of-feed signal; hasMore would say the same thing twice.
  return Response.json({
    group: { name: member.group.name, slug: member.group.slug },
    items: page.items,
    nextCursor: page.nextCursor,
  });
}
