# Circle Product Roadmap

Goal: make Circle attractive enough that members bring their friends. Groups stay
private and invite-only; growth comes from a richer product plus a small set of
deliberate sharing mechanics.

Scoring: **Impact** = expected effect on member activity or joins. **Effort** =
rough build size given the current codebase.

---

## Tier 1 — ship next (builds directly on what exists)

| # | Feature | Area | Impact | Effort | Builds on |
|---|---------|------|--------|--------|-----------|
| 1 | Finish comments + reactions | Engagement | High | Low | `lib/queries/comments.ts`, `components/comment-*.tsx`, migrations 0016/0017 |
| 2 | Polls | Engagement | High | Medium | Post kinds (`lib/kind.ts`) |
| 3 | Full-text search | Organization | High | Medium | Existing trigram title index |
| 4 | "Since you left" recap | Awareness | Medium | Low | Feed queries (`lib/queries/feed.ts`) |

### 1. Finish comments + reactions
Threaded comments (one level deep), comment reactions, and the engagement bar are
already built and uncommitted. Everything else on this roadmap benefits from a
live discussion layer, so land it first. Remaining work: review, test, commit,
migrate.

### 2. Polls
New `poll` post kind: author writes a question plus 2–6 options; members vote once
and see live results. Groups deciding "which book next" or "which movie Friday"
is a recurring reason to open the app. Implementation: extend the kind allowlist
in `lib/kind.ts`, add `poll_options` and `poll_votes` tables (vote unique per
user per poll), render results in `post-card.tsx`.

### 3. Full-text search
Search currently matches post titles only (trigram ILIKE). Extend to post bodies
and comments with a Postgres `tsvector` column + GIN index, ranked with
`ts_rank`. A group's shared links become a searchable knowledge base — a strong
"join us, everything we've ever shared is findable" pitch.

### 4. "Since you left" recap
Store `last_seen_at` on the membership row; on group feed load, show a compact
banner: "12 new posts, 34 comments, 3 polls since Tuesday" with a jump-to-first
link. Cheap to build from existing tables and directly combats the
open-the-app-see-nothing-new-leave loop.

---

## Tier 2 — next (content + rhythm)

| # | Feature | Area | Impact | Effort | Builds on |
|---|---------|------|--------|--------|-----------|
| 5 | Image uploads | Content | High | Medium | Vercel Blob; cover rendering |
| 6 | Inline media embeds | Content | High | Low-Med | OG preview pipeline |
| 7 | Ritual threads | Engagement | Medium | Medium | Vercel cron, group settings |
| 8 | Group stats page | Awareness | Medium | Low-Med | Aggregate queries over existing tables |
| 9 | Read-later upgrade | Organization | Medium | Low | Saved posts read/archive states |
| 10 | Events + RSVP | Organization | Medium | Medium | Post kinds, notifications |

### 5. Image uploads in posts and comments
Members share screenshots, memes, and photos as naturally as links. Store in
Vercel Blob (private), validate type/size server-side, render in the existing
cover/preview slots of `post-card.tsx`.

### 6. Inline media embeds
A YouTube link should play in the feed, not sit behind a static OG card. Add an
oEmbed/iframe map keyed by URL host (YouTube, Vimeo, Spotify, SoundCloud) in the
existing preview pipeline; fall back to the current OG card for everything else.
Allowlist hosts — no arbitrary iframes.

### 7. Ritual threads
Group owners schedule a recurring prompt ("Friday finds — what did you discover
this week?"). A Vercel cron creates the post automatically; members get the
existing `new_post` notification. Rituals give quiet groups a heartbeat and new
members an obvious place to make their first post.

### 8. Group stats page
`/groups/[slug]/stats`: most active members, top-reacted links, posting streak,
post-kind breakdown. All aggregate queries over existing tables. Social proof
inside the group — and a natural screenshot to send a friend.

### 9. Read-later upgrade
Saved posts already track read/unread and archive states. Add a "next up" queue
view sorted by save date with a progress header ("4 of 12 read"). Mostly UI over
existing data.

### 10. Events + RSVP
New `event` post kind with date/time and going/maybe/no RSVP. Book-club meetings
and watch parties currently organized in the WhatsApp thread move into Circle.
New `event_rsvps` table; RSVP triggers the existing notification pipeline.

---

## Tier 3 — later (bigger bets)

| # | Feature | Area | Impact | Effort | Builds on |
|---|---------|------|--------|--------|-----------|
| 11 | AI link summaries | Content | High | Medium | Vercel AI Gateway; OG fetch pipeline |
| 12 | Real-time feed + presence | Communication | Medium | Med-High | Vercel Functions WebSockets/SSE |
| 13 | Group chat channel | Communication | High | High | #12 infra |
| 14 | Topic channels | Organization | Medium | Medium | Feed queries |
| 15 | Direct messages | Communication | Low-Med | High | #13 infra |

### 11. AI link summaries
TLDR under each shared link plus a "catch me up" button that summarizes unread
posts. The OG fetch pipeline already pulls page metadata; add content extraction
and a summarization call through Vercel AI Gateway, cached per URL.

### 12. Real-time feed + presence
Live insertion of new posts/comments and who's-online dots. WebSockets on Vercel
Functions (Fluid Compute) or SSE. Infrastructure prerequisite for chat.

### 13. Group chat channel
A lightweight chat tab beside the feed for the ephemeral banter that currently
keeps groups on WhatsApp. New `messages` table, realtime delivery via #12. High
effort, high stickiness — do only after realtime infra is proven.

### 14. Topic channels
Sub-feeds inside a group beyond tags (e.g. #books, #tools). Posts get an optional
`channel_id`; feed queries filter by it. For groups that outgrow one stream.

### 15. Direct messages
Member-to-member DMs reusing chat infra. Deliberately last: it moves Circle
toward a messenger, which is a positioning decision as much as a feature.

---

## Growth mechanics (parallel track, small items)

| # | Feature | Impact | Effort | Builds on |
|---|---------|--------|--------|-----------|
| G1 | Public post share pages | High | Medium | Invite tokens (`lib/queries/invite.ts`) |
| G2 | Invite page revamp | High | Low-Med | `app/join/[token]/` |
| G3 | Weekly email digest | High | Medium | Resend, Vercel cron |
| G4 | Onboarding to first value | Medium | Low | — |

### G1. Public post share pages
A member explicitly generates a public URL for a single post: clean read-only
view plus a "Join {group} on Circle" CTA wired to an invite token. The OG unfurl
in WhatsApp/iMessage is the advertisement. New route outside the `(app)` group
(e.g. `app/s/[shareId]/`), per-post share table with revoke; sharer or post
author can revoke. Group stays private — sharing is opt-in and per-post.

### G2. Invite page revamp
`/join/[token]` becomes a pitch: inviter name and avatar, group cover, member
avatars, post count, recent post titles. First impression for every new user.

### G3. Weekly email digest
Top posts per group via Resend on a Vercel cron. Forward-friendly layout with an
invite CTA in the footer — retention and passive acquisition in one.

### G4. Onboarding to first value
After joining, land directly in the group feed with a gentle nudge to react to
something; polish empty states for brand-new groups.

---

## Out of scope

- **Public/discoverable groups, explore page, SEO-indexed content** — conflicts
  with private-by-design.
- **Gamification (badges, streak mechanics)** beyond the stats page — revisit
  once retention data exists.

## Sequencing rationale

Tier 1 maximizes reuse of in-flight work (comments) and existing tables — a
livelier app within weeks. Tier 2 makes content richer and gives groups a weekly
rhythm. Tier 3 items each need new infrastructure (AI Gateway, realtime), so they
come after the app has enough activity to justify them. Growth items are small
and independent — interleave one per development cycle, starting with G1.
