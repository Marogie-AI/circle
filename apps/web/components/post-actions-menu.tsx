"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DeleteIcon, EditIcon, MoreIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";

/**
 * Edit / delete menu, rendered only when the viewer is the author or the group owner.
 * That check is presentational — the server actions re-check it in their own WHERE
 * clause, so hiding the button is convenience, never the security boundary.
 *
 * Delete confirms through an in-app dialog (not window.confirm) so it matches the product's
 * look instead of the grey browser chrome.
 */
export function PostActionsMenu({
  editHref,
  onDelete,
  deleteLabel = "Delete post",
  confirmText = "Delete this post? Its comments and reactions go with it.",
}: {
  editHref?: string;
  onDelete: () => Promise<void>;
  deleteLabel?: string;
  confirmText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setConfirming(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Post actions"
        className="rounded-lg p-1.5 text-faint transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
      >
        <MoreIcon size={16} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 origin-top-right animate-menu-in overflow-hidden rounded-xl border border-line bg-surface/95 shadow-lg backdrop-blur-sm motion-reduce:animate-none"
        >
          {editHref ? (
            <Link
              href={editHref}
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-ink transition hover:bg-hover"
            >
              <EditIcon size={15} />
              Edit
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className="flex w-full items-center gap-2 border-t border-hairline px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
          >
            <DeleteIcon size={15} />
            {deleteLabel}
          </button>
        </div>
      ) : null}

      {confirming ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setConfirming(false)}
            className="absolute inset-0 animate-fade-in cursor-default bg-black/40 motion-reduce:animate-none"
          />
          <div className="relative z-10 w-full max-w-sm animate-dialog-in rounded-2xl border border-line bg-elevated p-5 shadow-xl motion-reduce:animate-none">
            <p className="text-sm leading-6 text-ink">{confirmText}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
              >
                Cancel
              </button>
              {/* useFormStatus (inside SubmitButton) reads this form's pending state, so a
                  second click while the delete is in flight is blocked. */}
              <form
                action={async () => {
                  await onDelete();
                  setConfirming(false);
                }}
              >
                <SubmitButton
                  pendingLabel="Deleting…"
                  className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
                >
                  {deleteLabel}
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
