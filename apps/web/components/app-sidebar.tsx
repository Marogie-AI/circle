"use client";

import { useEffect, useState } from "react";
import { SidebarContent, type SidebarProps } from "@/components/sidebar-content";

const STORAGE_KEY = "circle-sidebar-collapsed";

/**
 * Desktop rail — variant S5 (floating card). Positioning and collapse state only;
 * the contents come from SidebarContent, which the mobile drawer also renders.
 *
 * No overflow-hidden here: it would clip the user menu popping up from the footer.
 */
export function AppSidebar(props: SidebarProps) {
  // Starts expanded on every load, then corrects from localStorage after mount.
  // Reading storage during render would desync server and client HTML.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Private mode or blocked storage: stay expanded, nothing to recover.
    }
  }, []);

  function toggle() {
    setCollapsed((wasCollapsed) => {
      const next = !wasCollapsed;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Preference just will not survive a reload.
      }
      return next;
    });
  }

  return (
    <div
      className={`sticky top-0 hidden h-screen shrink-0 p-3 transition-[width] duration-200 md:block ${
        collapsed ? "w-[84px]" : "w-[284px]"
      }`}
    >
      <aside className="flex h-full flex-col rounded-2xl border border-line bg-surface shadow-sm">
        <SidebarContent
          {...props}
          collapsed={collapsed}
          onToggleCollapse={toggle}
        />
      </aside>
    </div>
  );
}
