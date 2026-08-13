/**
 * There is one reaction now: a like. It is still stored in the emoji column rather than
 * as a boolean, so the six older reactions (👍🔥😂🤯👀) remain valid rows instead of
 * needing a lossy migration that would forget which one each person picked.
 *
 * A "like" therefore means *this member has any reaction row on this post*. That keeps
 * historical counts honest — someone who once hit 🔥 still reads as having liked it, and
 * cannot like it a second time.
 */
export const LIKE_EMOJI = "❤️";

/** The write allowlist. Only a like can be created from now on. */
export const REACTION_EMOJIS = [LIKE_EMOJI] as const;

/** Accessible names for each stored reaction key, including the retired ones. */
export const REACTION_LABELS: Record<string, string> = {
  "❤️": "Like",
  "👍": "Agree",
  "🔥": "Fire",
  "😂": "Funny",
  "🤯": "Mind blown",
  "👀": "Watching",
};

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
