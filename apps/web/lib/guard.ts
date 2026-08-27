import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { findMembership } from "@/lib/queries/membership";

export { findMembership } from "@/lib/queries/membership";

export const requireMember = cache(async (slug: string) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    notFound();
  }

  const membership = await findMembership(slug, session.user.id);

  if (!membership) {
    notFound();
  }

  return {
    user: session.user,
    group: membership.group,
    role: membership.role,
  };
});

/**
 * The single owner gate. Every owner-only mutation routes through here, so adding one
 * cannot mean re-deriving the rule from `role` and getting the comparison subtly wrong.
 * `message` stays per-caller because it reaches the user; the check does not.
 */
export async function requireOwner(slug: string, message: string) {
  const membership = await requireMember(slug);
  if (membership.role !== "owner") {
    throw new Error(message);
  }
  return membership;
}

export const requireSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return session;
});
