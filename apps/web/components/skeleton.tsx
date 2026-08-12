/**
 * The one loading placeholder in the app. Uses bg-hover so it themes with everything
 * else — a hardcoded grey would be invisible in dark mode.
 *
 * Skeletons must mirror the real layout's dimensions. A placeholder that is not the
 * height of what replaces it trades a blank screen for a jump, which is worse.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`animate-pulse rounded-md bg-hover ${className}`} />
  );
}

/**
 * Page title block: eyebrow, heading, and the action buttons on the right.
 *
 * `eyebrow` is a prop because not every page has one — the group feed dropped its
 * eyebrow, and reserving that line anyway would push the title down and then snap it
 * back up, which is the jump this file exists to prevent.
 */
export function PageHeaderSkeleton({ eyebrow = true }: { eyebrow?: boolean }) {
  return (
    <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {eyebrow ? <Skeleton className="h-3 w-24" /> : null}
        <Skeleton className={`h-8 w-56 ${eyebrow ? "mt-3" : ""}`} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}
