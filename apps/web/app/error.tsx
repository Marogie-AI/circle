"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonStyles } from "@/components/page-header";
import { logError } from "@/lib/log";

/**
 * Without this file a throwing Server Action or page unmounts the whole route tree to
 * Next's default screen. `error.digest` is the only handle the user can quote and the
 * only value that ties their report to a server log line, so it stays on screen.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("ui.route_error", error, { digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-full w-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          That is on us, not you. Try again — if it keeps happening, the reference below
          tells us exactly what broke.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <button type="button" onClick={reset} className={buttonStyles.primary}>
            Try again
          </button>
          <Link href="/groups" className={buttonStyles.secondary}>
            Back to groups
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-6 font-mono text-xs text-muted">ref {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
