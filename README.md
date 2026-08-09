# Circle

Circle is a private group feed for sharing useful links and notes with friends—a replacement for losing the good stuff in WhatsApp chats.

```
apps/web      Next.js 16 app — the product. Postgres, better-auth, Server Actions.
apps/mobile   Flutter client — sign in, browse groups, read feeds. Read-only.
docs/         UI state checklist.
```

## Quickstart

```sh
docker compose up -d
cp apps/web/.env.example apps/web/.env.local
bun install
bun run db:migrate
bun run dev
```

Development runs on port 3002. Set `BETTER_AUTH_URL=http://localhost:3002` exactly; an origin or port mismatch causes better-auth to reject browser requests with a 403 response.

Email verification is enabled only when `RESEND_API_KEY` is set. Without it, local signup remains enabled and verification links are logged to the server console.

Root scripts (`dev`, `build`, `test`, `typecheck`, `db:migrate`) delegate to the `web` workspace. Deploying to Vercel requires the project's **Root Directory** set to `apps/web`.

## Tests

With the database running:

```sh
bun run test                      # web
cd apps/mobile && flutter test    # mobile
```

## Mobile

```sh
cd apps/mobile
flutter run                                                   # Android emulator (10.0.2.2)
flutter run --dart-define=CIRCLE_API=http://localhost:3002    # iOS simulator
```

The client authenticates with a bearer token, not a cookie: better-auth returns the raw
session token in the sign-in response body and the `bearer` plugin re-signs it server-side.
That keeps the app free of a cookie jar, and free of the origin check a cookie would trigger.
The token is held in memory only — there is no stay-signed-in behaviour yet.

Reads go through `/api/mobile/*`, which is deliberately thin: it reuses the same query
functions the web app uses, and nothing there mutates.

## Architecture

- All web mutations use Server Actions. `/api/mobile/*` is read-only.
- `apps/web/lib/guard.ts` (`requireMember`) is the single authorization chokepoint for pages;
  `apps/web/lib/api-auth.ts` (`apiMember`) is its Route Handler counterpart, same rule, JSON
  instead of a redirect.
- Feeds use keyset (cursor) pagination instead of `OFFSET` pagination.
- Group-scoped composite indexes keep feed and membership queries efficient.

## Security invariants

- Never accept a `groupId` from a client payload.
- Every group-scoped query goes through `requireMember` or `apiMember`.
- Never distinguish "group does not exist" from "you are not a member" — both are 404.
- Never enable `rehype-raw` for Markdown.
- Reactions are restricted to a fixed emoji allowlist.
- Post URLs are restricted to `http` and `https`.
