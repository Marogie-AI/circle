import 'package:flutter/material.dart';

/// Centred message that is still a scrollable, so RefreshIndicator keeps working when
/// the list it replaces is empty or errored.
class MessageView extends StatelessWidget {
  const MessageView(this.text, {super.key, this.isError = false});

  final String text;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
      children: [
        Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: isError ? Theme.of(context).colorScheme.error : null,
          ),
        ),
      ],
    );
  }
}
