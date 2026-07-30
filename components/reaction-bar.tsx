"use client";

import { useOptimistic, useTransition } from "react";
import { ReactionGlyph } from "@/components/reaction-glyph";
import { REACTION_EMOJIS, REACTION_LABELS } from "@/lib/post";

type State = { counts: Record<string, number>; mine: string[] };

/**
 * Reactions used to wait on a full server round-trip plus revalidatePath before the
 * count moved — the most-felt lag in the app. useOptimistic paints the new state
 * immediately; the server action stays authoritative and React reverts automatically
 * if it throws.
 */
export function ReactionBar({
  counts,
  mine,
  onToggle,
}: {
  counts: Record<string, number>;
  mine: string[];
  onToggle: (emoji: string) => Promise<void>;
}) {
  const [, startTransition] = useTransition();
  const [state, apply] = useOptimistic<State, string>(
    { counts, mine },
    (current, emoji) => {
      const active = current.mine.includes(emoji);
      return {
        counts: {
          ...current.counts,
          [emoji]: Math.max(0, (current.counts[emoji] ?? 0) + (active ? -1 : 1)),
        },
        mine: active
          ? current.mine.filter((e) => e !== emoji)
          : [...current.mine, emoji],
      };
    },
  );

  return (
    <div className="flex flex-wrap gap-1">
      {REACTION_EMOJIS.map((emoji) => {
        const active = state.mine.includes(emoji);
        const count = state.counts[emoji] ?? 0;
        const label = REACTION_LABELS[emoji] ?? "React";
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={active}
            aria-label={`${label} (${count})`}
            title={`${label} · ${count}`}
            onClick={() =>
              startTransition(async () => {
                apply(emoji);
                await onToggle(emoji);
              })
            }
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 ${
              active
                ? "bg-inverse text-inverse-ink"
                : "text-muted hover:bg-hover hover:text-ink"
            }`}
          >
            <ReactionGlyph emoji={emoji} size={17} />
            {count > 0 ? (
              <span className="tabular-nums text-xs font-medium">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
