"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserGroup } from "@/lib/queries/groups";
import { UserMenu } from "@/components/user-menu";
import { BookmarkIcon, GroupIcon, PlusIcon, TagIcon } from "@/components/icons";

export type SidebarProps = {
  groups: UserGroup[];
  user: { name?: string | null; email: string };
  tags?: { tag: string; count: number }[];
  unread?: Record<string, number>;
  /** Mobile drawer passes a close handler; the desktop rail passes nothing. */
  onNavigate?: () => void;
};

/**
 * The sidebar's contents, with no positioning of its own. Rendered by BOTH the desktop
 * rail and the mobile drawer so the two can never drift apart.
 */
export function SidebarContent({
  groups,
  user,
  tags = [],
  unread = {},
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const activeGroup = groups.find(
    (g) => pathname === `/groups/${g.slug}` || pathname.startsWith(`/groups/${g.slug}/`),
  );

  const link =
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2";

  return (
    <>
      <div className="px-5 pb-4 pt-5">
        <Link
          href="/groups"
          onClick={onNavigate}
          className="text-sm font-semibold tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
        >
          Circle
        </Link>
        <p className="mt-3 text-[11px] text-faint">Your private spaces</p>
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
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`${link} ${
                      active
                        ? "bg-inverse font-medium text-inverse-ink"
                        : "text-ink hover:bg-hover"
                    }`}
                  >
                    <GroupIcon size={16} className="shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1 truncate">{group.name}</span>
                    {count > 0 ? (
                      <span
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

        {groups.length === 0 ? (
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
          New group
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
          Saved
        </Link>

        {activeGroup && tags.length ? (
          <>
            <div className="my-4 border-t border-hairline" />
            <p className="flex items-center gap-1.5 px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
              <TagIcon size={13} />
              Filter by tag
            </p>
            <ul className="space-y-0.5">
              {tags.map(({ tag, count }) => (
                <li key={tag}>
                  <Link
                    href={`/groups/${activeGroup.slug}?tag=${encodeURIComponent(tag)}`}
                    onClick={onNavigate}
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
                  >
                    <span className="min-w-0 truncate">#{tag}</span>
                    <span className="shrink-0 text-xs text-faint">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="border-t border-hairline p-2">
        <UserMenu user={user} />
      </div>
    </>
  );
}
