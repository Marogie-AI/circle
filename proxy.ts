import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // This is only an optimistic cookie-presence UX check, never authorization.
  // Forged or expired cookies still reach requireMember, the security chokepoint.
  if (!getSessionCookie(request)) {
    const pathname = `/${request.nextUrl.pathname.replace(/^\/+/, "")}`;
    const next = `${pathname}${request.nextUrl.search}`;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  // Layouts cannot read a child route's params, but the sidebar needs to know which
  // group is open so it can fetch tag facets for THAT group only. Forwarding the
  // pathname lets app/(app)/layout.tsx scope one query instead of fetching facets
  // for every group the user belongs to. Presentation only — never trusted for access.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-circle-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = { matcher: ["/groups/:path*"] };
