"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { signUp } from "@/lib/auth-client";
import { safeRedirectTarget } from "@/lib/safe-redirect";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirectTarget(searchParams.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const result = await signUp.email({
      // Trimmed to match login exactly. If either side stops trimming the
      // password, accounts created before the change can no longer log in.
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? "").trim(),
    });

    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Unable to create your account.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm text-muted">A private place for the good stuff.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">Name</label>
            <input id="name" name="name" type="text" autoComplete="name" required disabled={pending} className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10 disabled:cursor-not-allowed disabled:bg-canvas" />
          </div>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required disabled={pending} className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10 disabled:cursor-not-allowed disabled:bg-canvas" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required disabled={pending} className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10 disabled:cursor-not-allowed disabled:bg-canvas" />
            <p className="mt-1.5 text-xs text-muted">At least 8 characters</p>
          </div>

          {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <button type="submit" disabled={pending} className="w-full rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-ink underline-offset-4 hover:underline">Log in</Link>
        </p>
      </div>
  );
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>;
}
