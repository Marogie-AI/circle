"use client";

import {
  EyeIcon,
  FavouriteIcon,
  FireIcon,
  LaughingIcon,
  SurpriseIcon,
  ThumbsUpIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

/**
 * Reactions are STORED as emoji (REACTION_EMOJIS in lib/post.ts) — those strings are
 * database keys and must not change. This renders the matching line icon instead.
 *
 * It must be a COMPONENT, not an exported lookup object: a plain object exported from
 * a "use client" module arrives in a server component as a client reference, so
 * indexing it returns undefined and React throws "Element type is invalid".
 * Passing the emoji string as a prop keeps the boundary serializable.
 */
const ICONS = {
  "👍": ThumbsUpIcon,
  "🔥": FireIcon,
  "❤️": FavouriteIcon,
  "😂": LaughingIcon,
  "🤯": SurpriseIcon,
  "👀": EyeIcon,
} as const;

export function ReactionGlyph({
  emoji,
  size = 17,
}: {
  emoji: string;
  size?: number;
}) {
  const icon = ICONS[emoji as keyof typeof ICONS];
  // unknown key: fall back to the stored emoji rather than crashing the page
  if (!icon) return <span aria-hidden="true">{emoji}</span>;
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} />;
}
