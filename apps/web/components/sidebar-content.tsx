"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserGroup } from "@/lib/queries/groups";
import { UserMenu } from "@/components/user-menu";
import { Wordmark } from "@/components/wordmark";
import {
  BookmarkIcon,
  CollapseSidebarIcon,
  GroupIcon,
  PlusIcon,
} from "@/components/icons";

export type SidebarProps = {
  groups: UserGroup[];
  user: { name?: string | null; email: string };
  unread?: Record<string, number>;
  /** Mobile drawer passes a close handler; the desktop rail passes nothing. */
  onNavigate?: () => void;
  /** Icon-only rail. Desktop only — the mobile drawer is never collapsed. */
  collapsed?: boolean;
  /** Desktop rail passes this; the mobile drawer omits it and shows no toggle. */
  onToggleCollapse?: () => void;
};

/**
 * The sidebar's contents, with no positioning of its own. Rendered by BOTH the desktop
 * rail and the mobile drawer so the two can never drift apart.
 */
export function SidebarContent({
  groups,
  user,
  unread = {},
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const activeGroup = groups.find(
    (g) => pathname === `/groups/${g.slug}` || pathname.startsWith(`/groups/${g.slug}/`),
  );

  // relative: the collapsed unread dot is positioned against this.
  const link = `relative flex items-center gap-2 rounded-lg py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 ${
    collapsed ? "justify-center px-0" : "px-3"
  }`;

  return (
    <>
      <div className={collapsed ? "px-3 pb-4 pt-5" : "px-5 pb-4 pt-5"}>
        {/* Wordmark and toggle share one row so the toggle never floats in a
            band of its own. Collapsed, the row becomes just the toggle and the
            mark drops to the line below it. */}
        <div
          className={`flex items-center gap-2 ${
            collapsed ? "flex-col" : "justify-between"
          }`}
        >
          {collapsed && onToggleCollapse ? (
            // Collapsed, the mark IS the expand control — there is no separate
            // toggle button to hunt for in an 84px rail.
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={false}
              aria-label="Expand sidebar"
              className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
            >
              <Wordmark size={28} showText={false} />
            </button>
          ) : (
            <Link
              href="/groups"
              onClick={onNavigate}
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
            >
              <Wordmark size={28} />
            </Link>
          )}

          {onToggleCollapse && !collapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded
              aria-label="Collapse sidebar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
            >
              <CollapseSidebarIcon size={18} />
            </button>
          ) : null}
        </div>

        {collapsed ? null : (
          <p className="mt-3 text-[11px] text-faint">Your private spaces</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <nav aria-label="Groups">
          <ul className="space-y-0.5">
            {groups.map((group) => {
              const active = activeGroup?.id === group.id;
              const count = unread[group.id] ?? 0;
              return (
                <li key={group.id}>
                  <Link
                    href={`/groups/${group.slug}`}
                    prefetch
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`${link} ${
                      active
                        ? "bg-inverse font-medium text-inverse-ink"
                        : "text-ink hover:bg-hover"
                    }`}
                  >
                    <GroupIcon size={16} className="shrink-0 opacity-70" />
                    {collapsed ? null : (
                      <span className="min-w-0 flex-1 truncate">{group.name}</span>
                    )}
                    {collapsed && count > 0 ? (
                      // No room for a number in a 68px rail; a dot still says
                      // "something new in here".
                      <span
                        role="img"
                        aria-label={`${count} unread`}
                        className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${
                          active ? "bg-surface" : "bg-inverse"
                        }`}
                      />
                    ) : null}
                    {!collapsed && count > 0 ? (
                      // role="img" so the label wins over the visible text: the badge
                      // truncates to "99+", the label carries the real count.
                      <span
                        role="img"
                        aria-label={`${count} unread`}
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                          active ? "bg-surface text-ink" : "bg-inverse text-inverse-ink"
                        }`}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {groups.length === 0 && !collapsed ? (
          <p className="px-3 py-2 text-sm text-faint">No groups yet</p>
        ) : null}

        <Link
          href="/groups"
          onClick={onNavigate}
          aria-current={pathname === "/groups" ? "page" : undefined}
          className={`mt-1 ${link} ${
            pathname === "/groups"
              ? "bg-rail font-medium text-ink"
              : "text-muted hover:bg-hover hover:text-ink"
          }`}
        >
          <PlusIcon size={16} />
          {collapsed ? null : "New group"}
        </Link>

        <Link
          href="/saved"
          onClick={onNavigate}
          aria-current={pathname === "/saved" ? "page" : undefined}
          className={`${link} ${
            pathname === "/saved"
              ? "bg-rail font-medium text-ink"
              : "text-muted hover:bg-hover hover:text-ink"
          }`}
        >
          <BookmarkIcon size={16} />
          {collapsed ? null : "Saved"}
        </Link>

        {/* Tag facets moved to the feed's own filter bar, where they sit beside the
            author and sort controls instead of duplicating them from the rail. */}
      </div>

      <div className="p-2">
        <UserMenu user={user} collapsed={collapsed} />
      </div>
    </>
  );
}
