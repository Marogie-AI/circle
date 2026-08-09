import 'package:flutter/material.dart';

import 'src/api/api_config.dart';
import 'src/api/circle_api.dart';
import 'src/screens/login_screen.dart';

void main() => runApp(CircleApp(api: CircleApi(kApiBase)));

/// The api is injected rather than constructed here so tests (and a future
/// staging build) can hand in a client pointed somewhere else.
class CircleApp extends StatelessWidget {
  const CircleApp({super.key, required this.api});

  final CircleApi api;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Circle',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1A1A1A)),
      ),
      home: LoginScreen(api: api),
    );
  }
}
