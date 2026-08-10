"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/guard";

export type SettingsState = { error?: string; ok?: string };

export async function updateDisplayName(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 60) {
    return { error: "Name must be between 1 and 60 characters." };
  }

  // Go through better-auth rather than writing the user row directly, so its session
  // cache stays consistent with the database.
  await auth.api.updateUser({ body: { name }, headers: await headers() });

  // the name is rendered in avatars, post bylines and comments across the app
  revalidatePath("/", "layout");
  return { ok: "Name updated." };
}

export async function updateBio(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await requireSession();
  const bio = String(formData.get("bio") ?? "").trim();
  if (bio.length > 200) {
    return { error: "Bio must be 200 characters or fewer." };
  }

  // Bio isn't part of better-auth's session, so write the user row directly. Store null
  // rather than "" for an empty bio, so the profile page's "no bio" check is a plain null.
  await db
    .update(user)
    .set({ bio: bio || null })
    .where(eq(user.id, session.user.id));

  // shown on the public /u/[id] profile
  revalidatePath("/", "layout");
  return { ok: "Bio updated." };
}

export async function changePassword(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
        // A password change is also the account-recovery path. Any session an attacker
        // established with the old password must stop working immediately.
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch {
    // deliberately vague: never confirm whether the current password was right
    return { error: "Could not change password. Check your current password." };
  }

  return { ok: "Password changed." };
}
