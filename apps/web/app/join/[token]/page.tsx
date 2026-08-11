import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { acceptInviteAction } from "@/app/join/[token]/actions";
import { auth } from "@/lib/auth";
import { findValidInvite } from "@/lib/queries/invite";

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;
  const invite = await findValidInvite(token);

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm p-8 text-center">
          <p className="text-sm font-semibold tracking-tight text-ink">Circle</p>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">
            This invite link no longer works
          </h1>
          <p className="mt-2 text-sm text-muted">Ask the person who invited you for a new link.</p>
          <Link href="/" className="mt-6 inline-flex rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2">
            Go to Circle
          </Link>
        </div>
      </main>
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect(`/signup?next=/join/${encodeURIComponent(token)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm p-8 text-center">
        <p className="text-sm font-semibold tracking-tight text-ink">Circle</p>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">
          Join {invite.group.name}?
        </h1>
        <p className="mt-2 text-sm text-muted">
          You’ll become a member of this private group.
        </p>
        <form action={acceptInviteAction.bind(null, token)} className="mt-6">
          <button
            type="submit"
            className="inline-flex rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
          >
            Join group
          </button>
        </form>
      </div>
    </main>
  );
}
