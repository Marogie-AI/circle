import { Suspense } from "react";
import { headers } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { CommandPalette } from "@/components/command-palette";
import { SidebarSkeleton } from "@/components/sidebar-skeleton";
import { getChromeData } from "@/app/(app)/chrome-data";
import { auth } from "@/lib/auth";

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

  const user = session.user;

  return (
    // h-screen + overflow-hidden here means the DOCUMENT never scrolls, so there is
    // no page-level scrollbar and no body rubber-banding. The content column below
    // scrolls instead — clipping it outright would hide every post past the fold.
    //
    // Deliberately NO bg-canvas: this shell covers the whole viewport, so painting it
    // would hide the gradient on <body> (see globals.css) everywhere inside the app.
    <div className="flex h-screen w-full overflow-hidden">
      {/* The sidebar's queries used to be awaited by this layout, which held EVERY
          page behind them — one slow query blanked the whole app. Behind Suspense the
          chrome streams in beside the page instead of ahead of it. */}
      <Suspense fallback={<SidebarSkeleton />}>
        <DesktopChrome userId={user.id} user={user} />
      </Suspense>

      {/* overflow-x-hidden: the feed's 720px table has its own horizontal scroller,
          but without this the page itself stretches to fit it on a phone and every
          other element ends up wider than the viewport. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {/* Stays inside the scrolling column: it is sticky, and hoisting it out would
            make it a flex item in the row beside the sidebar. */}
        <Suspense fallback={null}>
          <MobileChrome userId={user.id} user={user} />
        </Suspense>
        {children}
      </div>
    </div>
  );
}

type ChromeProps = {
  userId: string;
  user: { name?: string | null; email: string };
};

async function DesktopChrome({ userId, user }: ChromeProps) {
  const { groups, unread, unreadNotifications } = await getChromeData(userId);
  return (
    <>
      <AppSidebar
        groups={groups}
        user={user}
        unread={unread}
        unreadNotifications={unreadNotifications}
      />
      <CommandPalette groups={groups} />
    </>
  );
}

async function MobileChrome({ userId, user }: ChromeProps) {
  const { groups, unread, unreadNotifications } = await getChromeData(userId);
  return (
    <MobileNav
      groups={groups}
      user={user}
      unread={unread}
      unreadNotifications={unreadNotifications}
    />
  );
}
