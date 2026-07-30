"use client";

import { useEffect, useRef } from "react";

/**
 * Marks a group read AFTER the page has painted.
 *
 * Doing it during render would clear the badge before the user has actually looked at
 * what caused it — and worse, would make the "new" dots vanish in the same paint that
 * introduced them. Firing on mount means the current render still shows what's new.
 */
export function MarkSeen({ mark }: { mark: () => Promise<void> }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void mark().catch(() => {});
  }, [mark]);
  return null;
}
