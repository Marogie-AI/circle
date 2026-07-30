"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DeleteIcon, EditIcon, MoreIcon } from "@/components/icons";

/**
 * Edit / delete menu, rendered only when the viewer is the author or the group owner.
 * That check is presentational — the server actions re-check it in their own WHERE
 * clause, so hiding the button is convenience, never the security boundary.
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
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
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
          <form
            action={async () => {
              await onDelete();
            }}
            onSubmit={(e) => {
              // eslint-disable-next-line no-alert
              if (!window.confirm(confirmText)) e.preventDefault();
            }}
          >
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 border-t border-hairline px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
            >
              <DeleteIcon size={15} />
              {deleteLabel}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
