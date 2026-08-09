import { PageHeaderSkeleton, Skeleton } from "@/components/skeleton";

export default function SettingsLoading() {
  return (
    <main className="min-h-full w-full px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      <PageHeaderSkeleton />
      <div className="mt-8 max-w-4xl space-y-10">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-9 w-28" />
          </div>
        ))}
      </div>
    </main>
  );
}
