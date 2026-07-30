"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarContent, type SidebarProps } from "@/components/sidebar-content";
import { ClearIcon, MenuIcon } from "@/components/icons";

/**
 * Below md the rail is hidden, which previously left no way at all to reach another
 * group — a real problem, because invite links get opened on phones from WhatsApp.
 * This is the phone navigation: a sticky bar plus a drawer over the same SidebarContent.
 */
export function MobileNav(props: Omit<SidebarProps, "onNavigate">) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // close on navigation, so tapping a group doesn't leave the drawer covering it
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // stop the page behind the drawer from scrolling
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const activeGroup = props.groups.find(
    (g) => pathname === `/groups/${g.slug}` || pathname.startsWith(`/groups/${g.slug}/`),
  );
  const totalUnread = Object.values(props.unread ?? {}).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="relative -ml-1 rounded-lg p-2 text-ink transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
        >
          <MenuIcon size={20} />
          {totalUnread > 0 ? (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-inverse" />
          ) : null}
        </button>
        <Link href="/groups" className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-ink">
          {activeGroup?.name ?? "Circle"}
        </Link>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-inverse/40"
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-surface shadow-xl focus:outline-none"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
            >
              <ClearIcon size={18} />
            </button>
            <SidebarContent {...props} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
