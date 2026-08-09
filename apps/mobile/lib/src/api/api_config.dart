/// Base URL of the Next.js app.
///
/// Android emulator reaches the host's localhost through 10.0.2.2, so that is the default.
/// iOS simulator / device:
///   flutter run --dart-define=CIRCLE_API=http://localhost:3002
const kApiBase = String.fromEnvironment(
  'CIRCLE_API',
  defaultValue: 'http://10.0.2.2:3002',
);
