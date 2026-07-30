"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Avatar } from "@/components/avatar";
import { MoreIcon, SettingsIcon, SignOutIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Replaces the old sidebar footer, which crammed an avatar, name, email and a full
 * "Sign out" button into 260px — with a real name and email everything truncated and
 * the button wrapped onto two lines. The trigger now shows only the name; the panel
 * is wider than the rail, so the full email finally fits.
 */
export function UserMenu({
  user,
}: {
  user: { name?: string | null; email: string };
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const displayName = user.name || user.email;

  async function handleSignOut() {
    setPending(true);
    await signOut();
    router.refresh();
  }

  return (
    <div ref={wrapRef} className="relative">
      {open ? (
        <div
          role="menu"
          // w-full, not a fixed width: the panel must stay inside the sidebar card
          // or it spills past the rounded edge and breaks the floating-card look
          className="absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        >
          {/* Only the email here — the trigger directly below already shows the avatar
              and name, so repeating them made the open menu read as duplicated. */}
          <p
            title={user.email}
            className="truncate border-b border-hairline px-3 py-2.5 text-xs text-muted"
          >
            {user.email}
          </p>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ink transition hover:bg-hover focus-visible:bg-canvas focus-visible:outline-none"
          >
            <SettingsIcon size={16} />
            Settings
          </Link>
          <ThemeToggle />
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={pending}
            className="flex w-full items-center gap-2 border-t border-hairline px-3 py-2.5 text-left text-sm text-ink transition hover:bg-hover focus-visible:bg-canvas focus-visible:outline-none disabled:opacity-60"
          >
            <SignOutIcon size={16} />
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
      >
        <Avatar name={displayName} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
          {displayName}
        </span>
        <MoreIcon size={16} className="shrink-0 text-faint" />
      </button>
    </div>
  );
}
