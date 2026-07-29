export const REACTION_EMOJIS = ["👍", "🔥", "❤️", "😂", "🤯", "👀"] as const;

/** Accessible names for each stored reaction key. Plain data — safe in server components. */
export const REACTION_LABELS: Record<string, string> = {
  "👍": "Agree",
  "🔥": "Fire",
  "❤️": "Love",
  "😂": "Funny",
  "🤯": "Mind blown",
  "👀": "Watching",
};

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
