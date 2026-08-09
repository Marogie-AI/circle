import { Skeleton } from "@/components/skeleton";

/**
 * Placeholder for the desktop rail while its queries run. Mirrors AppSidebar's
 * geometry exactly — same width, same p-3 gutter, same card — so the real sidebar
 * swaps in without the page shifting sideways.
 */
export function SidebarSkeleton() {
  return (
    <div className="sticky top-0 hidden h-screen w-[284px] shrink-0 p-3 md:block">
      <aside className="flex h-full flex-col rounded-2xl border border-line bg-surface shadow-sm">
        <div className="px-5 pb-4 pt-5">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 px-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>

        <div className="border-t border-hairline p-2">
          <Skeleton className="h-10 w-full" />
        </div>
      </aside>
    </div>
  );
}
