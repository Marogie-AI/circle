"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserGroup } from "@/lib/queries/groups";
import { UserMenu } from "@/components/user-menu";
import { GroupIcon, PlusIcon, TagIcon } from "@/components/icons";

// Variant S5 (floating card rail) — chosen from /design.
// The outer div is the page-coloured gutter; the inner <aside> is the detached card.
export function AppSidebar({
  groups,
  user,
  tags = [],
}: {
  groups: UserGroup[];
  user: { name?: string | null; email: string };
  tags?: { tag: string; count: number }[];
}) {
  const pathname = usePathname();
  const activeGroup = groups.find(
    (g) => pathname === `/groups/${g.slug}` || pathname.startsWith(`/groups/${g.slug}/`),
  );

  return (
    <div className="sticky top-0 hidden h-screen w-[284px] shrink-0 bg-neutral-100 p-3 md:block">
      {/* no overflow-hidden: it would clip the user menu popping up from the footer.
          The scroll area below has its own overflow, so corners still look right. */}
      <aside className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="px-5 pb-4 pt-5">
          <Link
            href="/groups"
            className="text-sm font-semibold tracking-tight text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Circle
          </Link>
          <p className="mt-3 text-[11px] text-neutral-400">Your private spaces</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <nav aria-label="Groups">
            <ul className="space-y-0.5">
              {groups.map((group) => {
                const href = `/groups/${group.slug}`;
                const active = activeGroup?.id === group.id;
                return (
                  <li key={group.id}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ${
                        active
                          ? "bg-neutral-900 font-medium text-white"
                          : "text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      <GroupIcon size={16} className="shrink-0 opacity-70" />
                      <span className="min-w-0 truncate">{group.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {groups.length === 0 ? (
            <p className="px-3 py-2 text-sm text-neutral-400">No groups yet</p>
          ) : null}

          <Link
            href="/groups"
            aria-current={pathname === "/groups" ? "page" : undefined}
            className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ${
              pathname === "/groups"
                ? "bg-neutral-100 font-medium text-neutral-900"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            <PlusIcon size={16} />
            New group
          </Link>

          {activeGroup && tags.length ? (
            <>
              <div className="my-4 border-t border-neutral-100" />
              <p className="flex items-center gap-1.5 px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                <TagIcon size={13} />
                Filter by tag
              </p>
              <ul className="space-y-0.5">
                {tags.map(({ tag, count }) => (
                  <li key={tag}>
                    <Link
                      href={`/groups/${activeGroup.slug}?tag=${encodeURIComponent(tag)}`}
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                    >
                      <span className="min-w-0 truncate">#{tag}</span>
                      <span className="shrink-0 text-xs text-neutral-400">{count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <div className="border-t border-neutral-100 p-2">
          <UserMenu user={user} />
        </div>

      </aside>
    </div>
  );
}
