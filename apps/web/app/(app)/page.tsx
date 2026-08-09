import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// "/" is the signed-out landing only. Signed-in users belong in /groups, which is the
// real home: every group they're in, plus the create form.
export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/groups");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold tracking-tight">Circle</p>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight">
        Share the good stuff with your people.
      </h1>
      <p className="mt-4 max-w-md text-muted">
        A private place for useful links, notes, and the friends you trust.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/login"
          className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
