import 'package:flutter/material.dart';

import '../api/circle_api.dart';
import '../models/feed_item.dart';
import '../models/group.dart';
import '../widgets/feed_tile.dart';
import '../widgets/message_view.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key, required this.api, required this.group});

  final CircleApi api;
  final Group group;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final _items = <FeedItem>[];
  String? _cursor;
  bool _loading = true;
  bool _exhausted = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  /// Keyset pagination: pass the server's nextCursor straight back. Never compute a
  /// cursor here — the encoding belongs to lib/queries/feed.ts.
  Future<void> _load({bool reset = false}) async {
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _items.clear();
        _cursor = null;
        _exhausted = false;
      }
    });

    try {
      final page = await widget.api.feed(widget.group.slug, cursor: _cursor);
      if (!mounted) return;
      setState(() {
        _items.addAll(page.items);
        _cursor = page.nextCursor;
        _exhausted = page.nextCursor == null;
      });
    } on Exception catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.group.name)),
      body: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: _body(),
      ),
    );
  }

  Widget _body() {
    if (_items.isEmpty) {
      if (_loading) return const Center(child: CircularProgressIndicator());
      if (_error != null) return MessageView(_error!, isError: true);
      return const MessageView('No posts in this group yet.');
    }

    return ListView.separated(
      itemCount: _items.length + 1,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, index) {
        if (index < _items.length) return FeedTile(_items[index]);
        return _footer();
      },
    );
  }

  // ponytail: explicit "Load more" instead of a ScrollController + infinite scroll.
  // Swap it in when someone complains about tapping.
  Widget _footer() {
    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            TextButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_exhausted) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: Text('End of feed')),
      );
    }
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Center(
        child: OutlinedButton(onPressed: _load, child: const Text('Load more')),
      ),
    );
  }
}
