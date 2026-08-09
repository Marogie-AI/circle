/// One post as it appears in a feed page. Mirrors the select in lib/queries/feed.ts —
/// no body, no URL; those belong to a post-detail endpoint that does not exist yet.
class FeedItem {
  const FeedItem({
    required this.id,
    required this.title,
    required this.tags,
    required this.createdAt,
    required this.authorName,
    required this.commentCount,
    required this.reactionCount,
    this.ogImage,
  });

  factory FeedItem.fromJson(Map<String, dynamic> json) => FeedItem(
        id: json['id'] as String,
        title: json['title'] as String,
        tags: ((json['tags'] as List<dynamic>?) ?? const <dynamic>[])
            .map((tag) => tag as String)
            .toList(growable: false),
        createdAt: DateTime.parse(json['createdAt'] as String),
        authorName: json['authorName'] as String,
        commentCount: json['commentCount'] as int,
        reactionCount: json['reactionCount'] as int,
        ogImage: json['ogImage'] as String?,
      );

  final String id;
  final String title;
  final List<String> tags;
  final DateTime createdAt;
  final String authorName;
  final int commentCount;
  final int reactionCount;
  final String? ogImage;
}
