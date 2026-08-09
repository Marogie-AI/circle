import { PageHeaderSkeleton, Skeleton } from "@/components/skeleton";

export default function GroupSettingsLoading() {
  return (
    <main className="min-h-full w-full px-6 pb-10 pt-9 sm:px-10 sm:pb-14">
      <PageHeaderSkeleton />
      <div className="mt-8 max-w-4xl space-y-10">
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-28 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
