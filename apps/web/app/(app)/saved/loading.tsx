import { PageHeaderSkeleton, Skeleton } from "@/components/skeleton";

export default function SavedLoading() {
  return (
    <main className="min-h-full w-full px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      <PageHeaderSkeleton />
      <div className="mt-8 divide-y divide-hairline">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex h-16 items-center gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
          </div>
        ))}
      </div>
    </main>
  );
}
