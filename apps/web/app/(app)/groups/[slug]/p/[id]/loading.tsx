import { Skeleton } from "@/components/skeleton";

/**
 * Mirrors the post page: same full-width padding, header rule, then the article, the
 * reactions row and the comment box stacked. A different width here would slide the text
 * sideways when the real post replaced it.
 */
export default function PostLoading() {
  return (
    <main className="min-h-full w-full px-6 pb-10 pt-9 sm:px-10 sm:pb-16">
      <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>

      <Skeleton className="mt-10 h-8 w-2/3" />
      <Skeleton className="mt-4 h-4 w-48" />

      <div className="mt-8 space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            key={index}
            className={`h-4 ${index === 5 ? "w-1/2" : "w-full"}`}
          />
        ))}
      </div>

      {/* Reactions row, then the comment box — both sit below the article now. */}
      <Skeleton className="mt-10 h-8 w-56" />
      <Skeleton className="mt-8 h-20 w-full" />
    </main>
  );
}
