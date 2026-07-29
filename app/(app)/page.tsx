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
      <p className="mt-4 max-w-md text-neutral-500">
        A private place for useful links, notes, and the friends you trust.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/login"
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
