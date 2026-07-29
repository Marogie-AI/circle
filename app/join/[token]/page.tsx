import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { acceptInvite, findValidInvite } from "@/lib/queries/invite";

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;
  const invite = await findValidInvite(token);

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold tracking-tight text-neutral-900">Circle</p>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-900">
            This invite link no longer works
          </h1>
          <p className="mt-2 text-sm text-neutral-500">Ask the person who invited you for a new link.</p>
          <Link href="/" className="mt-6 inline-flex rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2">
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

  await acceptInvite(invite.groupId, session.user.id);
  redirect(`/groups/${invite.group.slug}`);
}
