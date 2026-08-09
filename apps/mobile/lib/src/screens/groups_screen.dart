import 'package:flutter/material.dart';

import '../api/circle_api.dart';
import '../models/group.dart';
import '../widgets/message_view.dart';
import 'feed_screen.dart';

class GroupsScreen extends StatefulWidget {
  const GroupsScreen({super.key, required this.api});

  final CircleApi api;

  @override
  State<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends State<GroupsScreen> {
  late Future<List<Group>> _groups = widget.api.groups();

  void _reload() => setState(() => _groups = widget.api.groups());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Groups')),
      body: RefreshIndicator(
        onRefresh: () async {
          _reload();
          await _groups.catchError((_) => <Group>[]);
        },
        child: FutureBuilder<List<Group>>(
          future: _groups,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return MessageView('${snapshot.error}', isError: true);
            }

            final groups = snapshot.data!;
            if (groups.isEmpty) {
              return const MessageView('No groups yet. Ask someone for an invite link.');
            }

            return ListView.separated(
              itemCount: groups.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final group = groups[index];
                return ListTile(
                  title: Text(group.name),
                  subtitle: Text(group.role),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => FeedScreen(api: widget.api, group: group),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
