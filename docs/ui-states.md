# UI states

The states the web app is expected to render, and what distinguishes each one. This is the
checklist to walk before shipping frontend work — every row should be reachable by hand
against a live Postgres, real sessions, and real Server Actions.

Screenshots and recordings are captured per pull request and attached there. They are not
committed: they go stale the moment the UI changes, and a repo is a poor place to version
megabytes of PNGs.

## Auth

| State | What it must show |
|---|---|
| Landing, logged out | Entry point; no group data of any kind |
| Signup | Email + password, minimum 8 characters |
| Login | Email + password |
| Login error | "Invalid email or password" — must not reveal whether the account exists |
| Dead invite | Revoked or expired invite — must not reveal the group name |
| Logged-out group link | Redirect to `/login?next=…` (a UX affordance, not the security boundary) |

## Feed

| State | What it must show |
|---|---|
| Group list | Groups the user belongs to, with unread badges |
| Feed populated | Posts with tags, comment and reaction counts |
| Feed filtered by tag | `?tag=engineering` applied, filter visibly active |
| Feed empty for a tag | Copy distinct from "no posts at all" — the difference is the whole point |
| Home, no groups | Fresh account with zero memberships |
| Compose | New post form with tag suggestions; "Save draft" keeps a post unpublished |
| Feed with pinned posts | Pinned strip above the feed — shows only on the unfiltered top-level view, never mid-filter or paginated |
| Post detail | Markdown body, reaction bar with the user's own reaction highlighted, comments with their own reactions, `@name` mentions rendered |
| Your drafts | A member's own unpublished posts; empty copy distinct from an empty feed |
| Draft, non-author | Someone else's draft is a 404 — must not reveal that a draft exists |

## Notifications

| State | What it must show |
|---|---|
| Notifications populated | Comment / reaction / new-post / mention rows, unread ones highlighted; the bell badge clears on view |
| Notifications empty | "Nothing yet" — distinct from an error |

## Profile

| State | What it must show |
|---|---|
| Profile | Display name, bio, and the target's posts limited to groups the *viewer* also belongs to |

## Settings

| State | What it must show |
|---|---|
| Group settings | Invite links (absolute URL derived from the request host), expiry, revoke, member roles |
| Member management | Owner-only: promote/demote/remove members; the last owner can be neither removed nor demoted |
| Account settings | Editable display name and bio |

## The critical loop

A brand-new person opens an invite link while logged out, is bounced to signup, signs up,
lands **inside the group**, writes a post, and sees it in the feed. Record this end to end,
in one take, whenever auth or invites change.

## Reproduce

```sh
docker compose up -d
bun run dev          # port 3002; BETTER_AUTH_URL must match exactly
```
