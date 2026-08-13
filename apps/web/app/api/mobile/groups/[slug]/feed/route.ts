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
    // Picked field by field, NOT `page.items` verbatim. getFeedPage serves the web feed
    // and grows whenever that UI needs something — it has already gained a body excerpt
    // and stock-cover credit columns this way. Returning its rows directly made every
    // one of those additions a silent change to this public payload. Adding a field here
    // is now a deliberate act.
    //
    // The shape below is FeedItem.fromJson in apps/mobile/lib/src/models/feed_item.dart.
    // Keep them in step; `kind` is additive and older clients ignore it.
    items: page.items.map((item) => ({
      id: item.id,
      title: item.title,
      tags: item.tags,
      createdAt: item.createdAt,
      authorName: item.authorName,
      commentCount: item.commentCount,
      reactionCount: item.reactionCount,
      // Still `ogImage`, because that is the key the Dart model reads. It now falls back
      // to the stock cover so mobile shows an image wherever the web feed does, without
      // the client needing to know a second source exists.
      ogImage: item.ogImage ?? item.coverUrl ?? null,
      kind: item.kind,
    })),
    nextCursor: page.nextCursor,
  });
}
