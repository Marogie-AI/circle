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

/** Page title block: eyebrow, heading, and the action buttons on the right. */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-56" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}
