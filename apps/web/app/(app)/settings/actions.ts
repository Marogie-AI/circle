"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
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
        // keep other devices signed in; this is a friends app, not a bank
        revokeOtherSessions: false,
      },
      headers: await headers(),
    });
  } catch {
    // deliberately vague: never confirm whether the current password was right
    return { error: "Could not change password. Check your current password." };
  }

  return { ok: "Password changed." };
}
