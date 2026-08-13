import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Mock routes are design surfaces: fake in-memory data, no database, no auth. Nothing
 * private leaks through them, which is exactly why nobody noticed they were reachable —
 * /mock/collection-controls has been live and unauthenticated since it was added.
 *
 * They still show unreleased work to anyone who guesses the URL, so they stop at the
 * door in production. A layout rather than a check inside each page, so the next mock
 * someone adds is covered without having to remember this.
 */
export default function MockLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
