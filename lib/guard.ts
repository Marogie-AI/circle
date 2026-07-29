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

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return session;
}
