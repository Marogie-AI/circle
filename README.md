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

## Checks

With the database running:

```sh
bun run typecheck
bun run test                      # web — needs Postgres
bun run lint                      # biome
bun run build
cd apps/mobile && flutter analyze && flutter test
```

CI runs all of these on every push and pull request (`.github/workflows/ci.yml`), against
a Postgres service container rather than a shared database.

Lint is [Biome](https://biomejs.dev), not ESLint — one binary, no plugin resolution, and
it does not need a config-compat shim to understand Next 16. The formatter is deliberately
switched off in `apps/web/biome.json`: turning it on would reformat every file in the repo
in a single unreviewable diff.

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

## Deploying

Vercel, with Neon Postgres.

- **Root Directory: `apps/web`**, with "Include files outside the Root Directory" on — the
  bun workspace hoists dependencies to the repo root. The build fails without this.
- `DATABASE_URL` → the Neon **pooled** (`-pooler`) host. `db/index.ts` caps the pool at one
  connection per serverless instance, which is only correct with the pooler in front.
- `BETTER_AUTH_SECRET` → `openssl rand -base64 32`.
- `BETTER_AUTH_URL` → `https://<domain>`, exact, no trailing slash. A mismatch makes
  better-auth reject browser requests with a 403.
- `RESEND_API_KEY` and `EMAIL_FROM` → without the key, `emailEnabled` is false and **email
  verification is silently disabled**. Set them, or launch with unverified signups on purpose.
- **Do not set `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD`.** `lib/env.ts` fails the build if
  either is present on a production deploy.

`lib/env.ts` runs on every server entrypoint, so a missing variable fails `next build`
rather than producing a green deploy that 500s on its first query.

**Migrations run by hand**, from your machine, against the Neon **direct** (non-pooled)
endpoint — drizzle-kit uses DDL and advisory locks that do not belong on a pooled
connection. Not in the build command: parallel builds would race each other.

```sh
pg_dump "$DIRECT_URL" > backup-$(date +%F).sql   # before every production migration
DATABASE_URL="$DIRECT_URL" bun run db:migrate
```

## Backups

Neon point-in-time restore is the backup. Set history retention to your plan's maximum in
the Neon console.

An untested backup is not a backup, so test it once before launch:

```sh
psql "$URL" -c "insert into groups (name, slug, created_by) values ('restore drill','restore-drill','<user-id>')"
date -u +"%Y-%m-%dT%H:%M:%SZ"                    # note this timestamp
psql "$URL" -c "delete from groups where slug = 'restore-drill'"
# Neon console: create a branch from a timestamp just before the delete
psql "$BRANCH_URL" -c "select slug from groups where slug = 'restore-drill'"   # row is there
# delete the branch
```

Deletes cascade hard — removing a group destroys its posts, comments, reactions, saves and
reads, with no soft-delete tombstone. PITR is the only way back, which is why the drill
matters.

## Security invariants

- Never accept a `groupId` from a client payload.
- Rate limits key on the session user id, never the IP — behind Vercel the IP is a proxy's.
- Every group-scoped query goes through `requireMember` or `apiMember`.
- Never distinguish "group does not exist" from "you are not a member" — both are 404.
- Never enable `rehype-raw` for Markdown.
- Reactions are restricted to a fixed emoji allowlist.
- Post URLs are restricted to `http` and `https`.
