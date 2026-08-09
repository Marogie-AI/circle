import { Skeleton } from "@/components/skeleton";

export default function PostLoading() {
  return (
    <main className="min-h-full w-full px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-6 h-8 w-2/3" />
      <Skeleton className="mt-3 h-4 w-48" />

      <div className="mt-8 space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            key={index}
            className={`h-4 ${index === 5 ? "w-1/2" : "w-full"}`}
          />
        ))}
      </div>

      <Skeleton className="mt-10 h-24 w-full" />
    </main>
  );
}
