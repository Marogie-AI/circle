"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/**
 * Submit button that disables and swaps its label while its form is in flight.
 *
 * useFormStatus reads the ENCLOSING form's pending state, so a server component page
 * can keep its plain <form action={serverAction}> and drop this in — no state, no
 * conversion of the page to a client component. It must live inside the form, not
 * render it, or the hook always reports idle.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  icon,
}: {
  children: ReactNode;
  pendingLabel: string;
  className: string;
  icon?: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {/* Both labels always occupy the same grid cell, so the button is sized to the
          wider of the two from the start — swapping them cross-fades instead of
          reflowing the whole action bar mid-request. */}
      <span className="grid place-items-center">
        <span
          aria-hidden={pending}
          className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 transition-opacity duration-200 ${
            pending ? "opacity-0" : "opacity-100"
          }`}
        >
          {icon}
          {children}
        </span>
        <span
          aria-hidden={!pending}
          className={`col-start-1 row-start-1 transition-opacity duration-200 ${
            pending ? "opacity-100" : "opacity-0"
          }`}
        >
          {pendingLabel}
        </span>
      </span>
    </button>
  );
}
