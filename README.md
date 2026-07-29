# Circle

Circle is a private group feed for sharing useful links and notes with friends—a replacement for losing the good stuff in WhatsApp chats.

## Quickstart

```sh
docker compose up -d
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

Development runs on port 3002. Set `BETTER_AUTH_URL=http://localhost:3002` exactly; an origin or port mismatch causes better-auth to reject browser requests with a 403 response.

Email verification is enabled only when `RESEND_API_KEY` is set. Without it, local signup remains enabled and verification links are logged to the server console.

## Tests

With the database running:

```sh
npm test
```

## Architecture

- All mutations use Server Actions.
- `lib/guard.ts` and its `requireMember` function are the single authorization chokepoint for group access.
- Feeds use keyset (cursor) pagination instead of `OFFSET` pagination.
- Group-scoped composite indexes keep feed and membership queries efficient.

## Security invariants

- Never accept a `groupId` from a client payload.
- Every group-scoped query goes through `requireMember`.
- Never enable `rehype-raw` for Markdown.
- Reactions are restricted to a fixed emoji allowlist.
- Post URLs are restricted to `http` and `https`.
