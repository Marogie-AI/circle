/// One membership row as returned by GET /api/mobile/groups.
class Group {
  const Group({required this.id, required this.name, required this.slug, required this.role});

  factory Group.fromJson(Map<String, dynamic> json) => Group(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        role: json['role'] as String,
      );

  final String id;
  final String name;
  final String slug;
  final String role;
}
