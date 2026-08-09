import 'feed_item.dart';

/// One keyset page of a group's feed.
class FeedPage {
  const FeedPage({required this.groupName, required this.items, required this.nextCursor});

  factory FeedPage.fromJson(Map<String, dynamic> json) => FeedPage(
        groupName: (json['group'] as Map<String, dynamic>)['name'] as String,
        items: (json['items'] as List<dynamic>)
            .map((item) => FeedItem.fromJson(item as Map<String, dynamic>))
            .toList(growable: false),
        nextCursor: json['nextCursor'] as String?,
      );

  final String groupName;
  final List<FeedItem> items;

  /// null is the end-of-feed signal. The server sends no separate hasMore flag.
  final String? nextCursor;
}
