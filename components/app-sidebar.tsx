import { SidebarContent, type SidebarProps } from "@/components/sidebar-content";

/**
 * Desktop rail (server component: no state, no hooks — it only positions
 * SidebarContent, which is the client boundary).
 *
 * Original note:
 * Desktop rail — variant S5 (floating card). Positioning only; the contents come from
 * SidebarContent, which the mobile drawer also renders.
 *
 * No overflow-hidden here: it would clip the user menu popping up from the footer.
 */
export function AppSidebar(props: SidebarProps) {
  return (
    <div className="sticky top-0 hidden h-screen w-[284px] shrink-0 bg-rail p-3 md:block">
      <aside className="flex h-full flex-col rounded-2xl border border-line bg-surface shadow-sm">
        <SidebarContent {...props} />
      </aside>
    </div>
  );
}
