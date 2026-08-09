import { PageHeaderSkeleton, Skeleton } from "@/components/skeleton";

/**
 * Mirrors the feed page: same pt-9, same padding, same row height (py-4 + a 17px
 * control ≈ h-14), so nothing moves when the table replaces it.
 */
export default function GroupFeedLoading() {
  return (
    <main className="min-h-full w-full px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      <PageHeaderSkeleton />

      <div className="mt-6 flex items-center gap-4">
        <Skeleton className="h-9 w-full sm:max-w-sm" />
        <Skeleton className="hidden h-9 w-36 sm:block" />
        <Skeleton className="hidden h-9 w-32 sm:block" />
      </div>

      <div className="mt-6 divide-y divide-hairline">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex h-14 items-center gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="hidden h-4 w-20 sm:block" />
          </div>
        ))}
      </div>
    </main>
  );
}
