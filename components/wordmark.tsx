import { CircleMark } from "@/components/circle-mark";

/**
 * Mark + wordmark as one locked-up unit, used by the sidebar and the auth screens.
 *
 * The spacing is a real gap now. It used to be `-space-x-1` cancelling out the
 * transparent margin baked into the PNG — the trace is cropped tight, so the gap is
 * a decision rather than a correction.
 */
export function Wordmark({
  size = 28,
  showText = true,
  className = "",
}: {
  size?: number;
  showText?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <CircleMark
        style={{ width: size, height: size }}
        // -translate-y-px: the mark's optical centre sits a hair below the cap-height
        // of the word beside it, so it reads as sagging without this.
        className="shrink-0 -translate-y-px text-ink"
      />
      {showText ? (
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
          Circle
        </span>
      ) : null}
    </span>
  );
}
