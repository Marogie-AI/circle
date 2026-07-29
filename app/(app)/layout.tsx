import { headers } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { auth } from "@/lib/auth";
import { listGroupsForUser, listTagFacets } from "@/lib/queries/groups";

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

  const groups = await listGroupsForUser(session.user.id);

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

  return (
    <div className="flex min-h-screen w-full bg-neutral-100">
      <AppSidebar groups={groups} user={session.user} tags={tags} />
      <div className="min-w-0 flex-1 bg-neutral-50">{children}</div>
    </div>
  );
}
