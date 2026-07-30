"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await signOut();
    router.refresh();
    setPending(false);
  }

  return (
    <button type="button" onClick={handleSignOut} disabled={pending} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
