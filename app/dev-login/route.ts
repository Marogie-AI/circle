import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * DEVELOPMENT-ONLY shortcut past the login form.
 *
 * It does NOT weaken authentication: it performs a real better-auth sign-in with real
 * credentials and gets a real session cookie. Every downstream check — requireMember,
 * author-or-owner, membership joins — behaves exactly as it does for a normal login.
 * Nothing about the security model changes; this only skips typing.
 *
 * It fails CLOSED behind two independent gates:
 *   1. NODE_ENV must not be "production" (so a production build cannot serve it)
 *   2. DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD must be set (absent in any real deploy)
 *
 * Both must hold. If either is missing the route 404s, exactly as if it did not exist.
 */
export async function GET(request: Request) {
  const email = process.env.DEV_LOGIN_EMAIL;
  const password = process.env.DEV_LOGIN_PASSWORD;

  if (process.env.NODE_ENV === "production" || !email || !password) {
    return new NextResponse("Not found", { status: 404 });
  }

  const target = new URL("/groups", request.url);

  try {
    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });

    const cookie = response.headers.get("set-cookie");
    if (!cookie) {
      return new NextResponse("Dev login failed: no session cookie returned", {
        status: 500,
      });
    }

    const redirect = NextResponse.redirect(target);
    redirect.headers.set("set-cookie", cookie);
    return redirect;
  } catch {
    // wrong DEV_LOGIN_* values, or the user does not exist
    return new NextResponse(
      "Dev login failed: check DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD in .env.local",
      { status: 500 },
    );
  }
}
