"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ChevronDownIcon, GroupIcon } from "@/components/icons";
import { KindIcon } from "@/components/kind-icon";
import { KIND_LABELS, POST_KINDS, parsePostKind } from "@/lib/kind";

/**
 * One group in the sidebar, with its categories as an inline expandable section.
 *
 * The sub-items BROWSE the group — they filter the feed to that category — so they are
 * navigation, not composition. Hence a chevron rather than a plus: a plus would promise
 * "create something here".
 *
 * Expanding pushes the rest of the nav down instead of floating over it. That costs a
 * little vertical space and buys three things a popover could not: nothing is ever
 * covered, the sub-items are visibly nested under their own group, and there is no
 * overflow clipping to fight inside the scrolling rail.
 */
export function GroupNavItem({
  group,
  active,
  count,
  collapsed,
  linkClass,
  onNavigate,
}: {
  group: { id: string; slug: string; name: string };
  active: boolean;
  count: number;
  collapsed: boolean;
  /** The shared row styling from SidebarContent, so rows can't drift apart. */
  linkClass: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panelId = useId();

  // Which category the feed is currently filtered to, if this is the open group.
  const activeKind =
    active && pathname === `/groups/${group.slug}`
      ? parsePostKind(searchParams.get("kind"))
      : null;

  // Start expanded when you arrive already filtered — otherwise the rail would
  // contradict the feed, showing nothing selected while a category is plainly active.
  const [open, setOpen] = useState(Boolean(activeKind));

  useEffect(() => {
    if (activeKind) setOpen(true);
  }, [activeKind]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  // The rail drops group names and unread counts when collapsed; categories go too.
  useEffect(() => {
    if (collapsed) setOpen(false);
  }, [collapsed]);

  return (
    <li>
      <div className={`group/row flex items-center ${collapsed ? "" : "pr-1"}`}>
        <Link
          href={`/groups/${group.slug}`}
          prefetch
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`${linkClass} min-w-0 flex-1 ${
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
            // Hidden while hovering or expanded, since the toggle claims this edge.
            <span
              role="img"
              aria-label={`${count} unread`}
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums group-focus-within/row:hidden group-hover/row:hidden ${
                open ? "hidden" : ""
              } ${active ? "bg-surface text-ink" : "bg-inverse text-inverse-ink"}`}
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Link>

        {collapsed ? null : (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            // Stable label: aria-expanded already announces collapsed/expanded, so
            // flipping the wording too is redundant noise for a screen reader.
            aria-label={`Categories in ${group.name}`}
            onClick={() => setOpen((value) => !value)}
            // Stays visible while a category is active, so the open section always has
            // a visible control attached to it. opacity rather than `hidden` so the row
            // never reflows on hover; group-focus-within covers the keyboard path that
            // hover alone would strand.
            className={`flex size-6 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-hover hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse group-focus-within/row:opacity-100 group-hover/row:opacity-100 ${
              open ? "bg-hover text-ink opacity-100" : "opacity-0"
            }`}
          >
            <ChevronDownIcon
              size={15}
              className={`transition-transform ${open ? "" : "-rotate-90"}`}
            />
          </button>
        )}
      </div>

      {open && !collapsed ? (
        // ml/border-l is the nesting cue: these belong to the group above them.
        <ul id={panelId} className="ml-[1.375rem] mt-0.5 border-l border-line pl-2">
          {POST_KINDS.map((kind) => {
            const selected = activeKind === kind;
            return (
              <li key={kind}>
                <Link
                  href={`/groups/${group.slug}?kind=${kind}`}
                  prefetch
                  onClick={onNavigate}
                  aria-current={selected ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse ${
                    selected
                      ? "bg-rail font-medium text-ink"
                      : "text-muted hover:bg-hover hover:text-ink"
                  }`}
                >
                  <KindIcon kind={kind} size={14} className="shrink-0" />
                  {KIND_LABELS[kind]}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
