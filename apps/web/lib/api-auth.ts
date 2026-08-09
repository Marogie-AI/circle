import { auth } from "@/lib/auth";
import { findMembership } from "@/lib/queries/membership";

/**
 * Route Handler counterpart to lib/guard.ts.
 *
 * guard.ts is for pages: requireMember throws notFound() / redirect(), which render HTML
 * or return a 307 to /login. A non-browser client follows that redirect and gets a login
 * page where it expected JSON, so the API side needs its own chokepoint returning status
 * codes. Same rule, different transport: never accept a groupId from the client, always
 * resolve membership from the session.
 */

export const jsonError = (status: number, error: string) =>
  Response.json({ error }, { status });

/** Session or null. Reads headers, so both the session cookie and a bearer token work. */
export const apiSession = (request: Request) =>
  auth.api.getSession({ headers: request.headers });

/**
 * 404 for BOTH "no such group" and "not a member" — findMembership joins groups against
 * memberships, so the two cases are indistinguishable by construction. Never branch on
 * group existence here: a 403 would itself confirm the group exists.
 */
export async function apiMember(request: Request, slug: string) {
  const session = await apiSession(request);
  if (!session) return { error: jsonError(401, "unauthorized") } as const;

  const membership = await findMembership(slug, session.user.id);
  if (!membership) return { error: jsonError(404, "not_found") } as const;

  return { session, ...membership } as const;
}
