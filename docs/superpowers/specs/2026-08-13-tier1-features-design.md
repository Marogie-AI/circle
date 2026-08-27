# Tier 1 features — design

Date: 2026-08-13
Scope: roadmap Tier 1 (`docs/roadmap.md`): land in-flight comments branch, then Polls (#2),
comment full-text search (#3 remainder), "Since you left" recap (#4).

Exploration found the roadmap stale in two places, which shrinks the work:

- Post full-text search already shipped: `posts.search_vector` (weighted tsvector over
  title+body, migration 0002) + GIN index + `searchGroupPosts()` in `lib/queries/search.ts`
  (websearch_to_tsquery with ILIKE trigram fallback). Only comments remain unindexed.
- Last-seen tracking already exists: `group_reads.last_seen_at`, `markGroupSeen()`
  (`lib/queries/reads.ts`), sidebar unread counts. The group page already fetches
  `lastSeen` in its `Promise.all` batch before re-stamping.

## 1. Land the comments branch

Threaded comments landed in commit `6c70569`. Remaining uncommitted work is small:
`comment-thread.tsx` + `reply-composer.tsx` tweaks (+6/−3), `group-nav-item.tsx` icon
alignment, `package.json`, untracked `apps/web/.gitignore`, `scripts/seed.ts`,
`scripts/backfill-group-covers.ts`. No pending migrations.

Plan: review the tweaks, lint + typecheck, then commit in separate units:

1. `fix(web)` — comment-thread + reply-composer tweaks (one behavior).
2. `fix(web): align category icons with group label text` — group-nav-item.
3. `chore(web)` — scripts + `.gitignore` (+ `package.json` if it belongs with them;
   otherwise with whichever commit its dependency change serves).

## 2. Polls

New `poll` post kind. Author writes a question (post title) plus 2–6 options; members
vote once, can change or remove their vote; live results with visible voters. No close
date, no anonymity flag (decided: YAGNI for private friend groups).

### Schema (new migration)

```
poll_options
  id         uuid PK default random
  post_id    uuid FK -> posts.id on delete cascade
  label      text not null
  position   int  not null
  index (post_id, position)

poll_votes
  post_id    uuid FK -> posts.id on delete cascade
  user_id    text FK -> user.id  on delete cascade
  option_id  uuid FK -> poll_options.id on delete cascade
  created_at timestamp default now()
  PK (post_id, user_id)          -- one vote per member per poll
  index (option_id)
```

`(post_id, user_id)` primary key enforces the single changeable vote; switching is an
upsert on conflict, mirroring the `reactions` composite-PK pattern.

### Code

- `lib/kind.ts`: add `"poll"` to `POST_KINDS`, label + icon entries.
- `createPost` action (`app/(app)/groups/[slug]/actions.ts`): when kind=poll, parse
  option fields from FormData, validate count 2–6 and label length, insert post +
  options in one transaction. Composer UI shows option inputs for the poll kind.
- New `votePoll(slug, postId, optionId)` server action, same shape as `toggleReaction`:
  `requireMember` guard, verify option belongs to the post, upsert vote; voting your
  current option again deletes the vote (toggle idiom). `invalidateGroupContent` +
  `revalidatePath` after write.
- Render: options render inline in `post-card.tsx` body (between title and tags) so
  members vote from the feed. Each option: label, count bar, voter avatar stack.
  Feed query aggregates counts only for kind=poll posts; the post detail page shows
  the same plus a full voter list.

### Redis

No new keys. Votes invalidate the existing first-page feed cache via
`invalidateGroupContent`, same as reactions.

## 3. Full-text search — comments

Posts are done; extend coverage to comment bodies. Per-group scope via the existing
`?q=` search box; no new UI surface.

- Schema: `search_vector` generated tsvector column on `comments` (body, english) +
  GIN index. Group scoping joins `comments -> posts` (no denormalized group_id;
  comment volume does not justify it yet).
- Query: extend `searchGroupPosts` with a comment arm — comments joined to published
  posts in the group, matched with `websearch_to_tsquery`. Comment hits map to their
  parent post; dedupe so each post appears once, ranked by the best of
  `ts_rank(post)` / `ts_rank(comment)`. Snippets via `ts_headline` on whichever text
  matched; comment-sourced rows label the snippet "in comments".
- No caching, matching current search behavior (low hit-rate per-query keys would
  waste Upstash commands).

## 4. "Since you left" recap

No schema change. One banner on the group feed page.

- Counts: one extra query appended to the page's existing `Promise.all` batch —
  posts and comments (and polls, once shipped) with `created_at > lastSeen`,
  excluding the member's own activity (same predicate as the sidebar unread LATERAL
  in `lib/queries/reads.ts`). One indexed count query; no Redis (per-user data,
  low reuse).
- Banner: server-rendered above the feed when counts > 0 and `lastSeen` is older
  than ~1 hour (suppresses noise on rapid revisits): "12 new posts, 34 comments
  since Tuesday". Dismiss is client-side state; the next visit re-stamps through
  the existing `markGroupSeen` flow, which also busts the sidebar badge.

## Sequencing

1 (land branch) → 2 (polls) → 3 (comment search) → 4 (recap). Recap counts polls,
so it goes last. Each feature is an independent commit sequence; migrations one per
feature.

## Out of scope

Poll close dates, anonymous votes, results-hidden-until-vote, global cross-group
search, jump-to-first-unseen anchor. Revisit on demand.
