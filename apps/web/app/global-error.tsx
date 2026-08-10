"use client";

import { useEffect } from "react";
import { logError } from "@/lib/log";

/**
 * Last resort: this catches failures in the root layout itself, which app/error.tsx
 * cannot — it lives inside that layout. Because the layout is what broke, this component
 * has to render its own <html> and <body>, and it cannot rely on any provider, context,
 * or shared component. Inline styles for the same reason: globals.css may never have
 * loaded. Keep it self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("ui.global_error", error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "2rem",
          color: "#171717",
          background: "#fafafa",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>
            Circle failed to load
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#525252" }}>
            Something broke before the page could render. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#171717",
              color: "#fff",
              padding: "0.75rem 1.125rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: "1.5rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#525252",
              }}
            >
              ref {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
