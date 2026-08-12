"use client";

import { useEffect, useRef, useState } from "react";
import { CopyIcon, TickIcon } from "@/components/icons";

type CopyButtonProps = {
  /**
   * What to copy. A root-relative path ("/groups/x/p/1") is resolved against the current
   * origin at click time, so callers on the server can pass a path without knowing the
   * deployment's host.
   */
  value: string;
  /** "label" is the bordered text button; "icon" is the bare glyph used in toolbars. */
  variant?: "label" | "icon";
  /** Accessible name for the icon variant, which has no visible text. */
  ariaLabel?: string;
  className?: string;
};

export function CopyButton({
  value,
  variant = "label",
  ariaLabel = "Copy",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function copy() {
    const absolute = value.startsWith("/")
      ? new URL(value, window.location.origin).toString()
      : value;

    try {
      await navigator.clipboard.writeText(absolute);
    } catch {
      // Clipboard access can be denied by permissions or a non-secure context. Saying
      // nothing beats throwing an unhandled rejection at the user.
      return;
    }

    setCopied(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => setCopied(false), 1800);
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={copy}
        aria-label={ariaLabel}
        title={copied ? "Copied" : ariaLabel}
        className={className}
      >
        {copied ? (
          <TickIcon size={18} className="text-emerald-600" />
        ) : (
          <CopyIcon size={18} />
        )}
        <span className="sr-only" aria-live="polite">
          {copied ? "Link copied" : ""}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        "shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
      }
      aria-live="polite"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
