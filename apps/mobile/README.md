# circle_mobile

Read-only Flutter client for Circle: sign in, list your groups, page through a feed.

```
lib/main.dart              wiring only — builds CircleApi, hands it to LoginScreen
lib/src/api/               api_config (base URL), circle_api (the only HTTP in the app), api_exception
lib/src/models/            group, feed_item, feed_page — JSON shapes from /api/mobile
lib/src/screens/           login, groups, feed
lib/src/widgets/           feed_tile, message_view
test/circle_api_test.dart  MockClient: bearer header, cursor forwarding, 401/404/429
```

## Run

```sh
flutter run                                                   # Android emulator (10.0.2.2)
flutter run --dart-define=CIRCLE_API=http://localhost:3002    # iOS simulator
flutter test
```

The web app must be running (`bun run dev` from the repo root, port 3002).

## Notes

- **Auth is a bearer token, not a cookie.** better-auth returns the raw session token in the
  sign-in body; the server's `bearer` plugin re-signs it. No cookie jar, no origin check.
- **Token lives in memory.** No secure storage until there is a stay-signed-in requirement.
- **`setState`, no state-management package.** Three screens in a straight parent→child
  stack sharing one `CircleApi`. Add `provider` when a screen needs the session without
  being pushed from the one above it.
- **Cursors are opaque.** Pass the server's `nextCursor` straight back; never build one here.
- Cleartext HTTP is enabled for the Android **debug** build only, and iOS is limited to
  `NSAllowsLocalNetworking`. Release builds need HTTPS.
