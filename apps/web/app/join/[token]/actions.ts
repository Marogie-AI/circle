"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { acceptInvite, findValidInvite } from "@/lib/queries/invite";

/** Accepting an invite is an explicit POST mutation, never a side effect of viewing it. */
export async function acceptInviteAction(token: string) {
  const invite = await findValidInvite(token);
  if (!invite) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(`/signup?next=/join/${encodeURIComponent(token)}`);
  }

  await acceptInvite(invite.groupId, session.user.id);
  redirect(`/groups/${invite.group.slug}`);
}
