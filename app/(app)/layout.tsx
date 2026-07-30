import { headers } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { CommandPalette } from "@/components/command-palette";
import { auth } from "@/lib/auth";
import { listGroupsForUser, listTagFacets } from "@/lib/queries/groups";
import { unreadCounts } from "@/lib/queries/reads";

// SECURITY: this layout is CHROME ONLY. It is not an authorization boundary.
// Rendering the sidebar for a signed-in user says nothing about which groups they
// may read — every group-scoped page and action still goes through requireMember()
// in lib/guard.ts, which is the single tested chokepoint. Never move an access
// check in here: layouts do not re-run on every navigation and cannot be relied on.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  // Signed out (e.g. the landing page at "/") renders bare, without app chrome.
  if (!session) return <>{children}</>;

  const [groups, unread] = await Promise.all([
    listGroupsForUser(session.user.id),
    unreadCounts(session.user.id),
  ]);

  // Slug comes from the header proxy.ts forwards, so tag facets are fetched for the
  // open group only. Cross-checked against the user's own memberships below, so a
  // spoofed header can never surface another group's tags.
  const slug = (requestHeaders.get("x-circle-pathname") ?? "").match(
    /^\/groups\/([^/]+)/,
  )?.[1];
  const activeGroup = slug
    ? groups.find((group) => group.slug === decodeURIComponent(slug))
    : undefined;
  const tags = activeGroup ? await listTagFacets(activeGroup.id) : [];

  const sidebar = {
    groups,
    user: session.user,
    tags,
    unread: Object.fromEntries(unread),
  };

  return (
    <div className="flex min-h-screen w-full bg-rail">
      <AppSidebar {...sidebar} />
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <MobileNav {...sidebar} />
        {children}
      </div>
      <CommandPalette groups={groups} />
    </div>
  );
}
