import { auth } from "@/lib/auth";
import { findMembership } from "@/lib/queries/membership";
import { allow } from "@/lib/rate-limit";

/**
 * Route Handler counterpart to lib/guard.ts.
 *
 * guard.ts is for pages: requireMember throws notFound() / redirect(), which render HTML
 * or return a 307 to /login. A non-browser client follows that redirect and gets a login
 * page where it expected JSON, so the API side needs its own chokepoint returning status
 * codes. Same rule, different transport: never accept a groupId from the client, always
 * resolve membership from the session.
 *
 * Everything under /api/mobile goes through apiUser, so the rate limit lives there once
 * rather than being repeated — and remembered — in each new route.
 */

/** Generous for a person, tight enough to blunt a script with a stolen token. */
const MOBILE_LIMIT = { max: 120, windowSeconds: 60 };

export const jsonError = (status: number, error: string) =>
  Response.json({ error }, { status });

/** Raw session or null. Reads headers, so the session cookie and a bearer token both work. */
export const apiSession = (request: Request) =>
  auth.api.getSession({ headers: request.headers });

/** Authenticated caller, or a ready-to-return 401/429. */
export async function apiUser(request: Request) {
  const session = await apiSession(request);
  if (!session) return { error: jsonError(401, "unauthorized") } as const;

  if (
    !(await allow(
      `mobile:${session.user.id}`,
      MOBILE_LIMIT.max,
      MOBILE_LIMIT.windowSeconds,
    ))
  ) {
    return { error: jsonError(429, "rate_limited") } as const;
  }

  return { session } as const;
}

/**
 * 404 for BOTH "no such group" and "not a member" — findMembership joins groups against
 * memberships, so the two cases are indistinguishable by construction. Never branch on
 * group existence here: a 403 would itself confirm the group exists.
 */
export async function apiMember(request: Request, slug: string) {
  const authenticated = await apiUser(request);
  // Re-wrap rather than returning `authenticated` directly: passing the whole narrowed
  // value through widens this function's return union with apiUser's success shape, and
  // callers then lose `group` off the happy path.
  if ("error" in authenticated) return { error: authenticated.error } as const;

  const membership = await findMembership(slug, authenticated.session.user.id);
  if (!membership) return { error: jsonError(404, "not_found") } as const;

  return { session: authenticated.session, ...membership } as const;
}
