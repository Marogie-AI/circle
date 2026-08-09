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

  // Nothing to forward: the x-circle-pathname header existed only so the layout could
  // scope tag facets to the open group, and those now load in the feed page itself.
  return NextResponse.next();
}

export const config = { matcher: ["/groups/:path*"] };
