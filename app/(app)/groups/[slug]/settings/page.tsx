import Link from "next/link";
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { createInvite, revokeInvite } from "@/app/(app)/groups/[slug]/actions";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/db";
import { invites, memberships, user as users } from "@/db/schema";
import { requireMember } from "@/lib/guard";

type SettingsPageProps = {
  params: Promise<{ slug: string }>;
};

function requestOrigin(host: string, forwardedProto: string | null) {
  const proto =
    forwardedProto?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${proto}://${host}`;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { slug } = await params;
  const { group, user, role } = await requireMember(slug);
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost";
  const origin = requestOrigin(host, requestHeaders.get("x-forwarded-proto"));
  const now = new Date();

  const [activeInvites, members] = await Promise.all([
    db
      .select({
        token: invites.token,
        expiresAt: invites.expiresAt,
      })
      .from(invites)
      .where(
        and(
          eq(invites.groupId, group.id),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, now),
        ),
      )
      .orderBy(desc(invites.createdAt)),
    db
      .select({
        userId: memberships.userId,
        name: users.name,
        email: users.email,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.groupId, group.id))
      .orderBy(asc(memberships.joinedAt)),
  ]);

  return (
    <main className="min-h-full w-full min-w-0 px-6 pb-10 pt-9 sm:px-10 sm:pb-14">
      {/* brand + identity live in the sidebar; only page actions stay here */}
      <div className="flex items-center justify-between gap-4">
        <p className="truncate text-sm text-muted">You are {role} of this group</p>
        <Link
          href={`/groups/${slug}`}
          className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
        >
          Back to group
        </Link>
      </div>

      <div className="max-w-4xl space-y-10 pt-6 pb-10">
        <section aria-labelledby="invite-heading" className="border-b border-hairline pb-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted">{group.name}</p>
              <h1 id="invite-heading" className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                Invite people
              </h1>
              <p className="mt-2 text-sm text-muted">Links expire seven days after they are created.</p>
            </div>
            <form action={createInvite.bind(null, slug)}>
              <SubmitButton
                pendingLabel="Creating…"
                className="w-full rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 sm:w-auto"
              >
                Create invite link
              </SubmitButton>
            </form>
          </div>

          {activeInvites.length > 0 ? (
            <ul className="mt-7 divide-y divide-hairline border-t border-hairline">
              {activeInvites.map((invite) => {
                const url = `${origin}/join/${encodeURIComponent(invite.token)}`;

                return (
                  <li key={invite.token} className="py-5">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                      <code className="min-w-0 flex-1 break-all rounded-lg bg-canvas px-3 py-2.5 text-sm text-ink" title={url}>
                        {url}
                      </code>
                      <div className="flex items-center gap-2">
                        <CopyButton value={url} />
                        <form action={revokeInvite.bind(null, slug, invite.token)}>
                          <SubmitButton
                            pendingLabel="Revoking…"
                            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
                          >
                            Revoke
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Expires {invite.expiresAt.toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-7 rounded-xl border border-dashed border-line px-5 py-8 text-center">
              <p className="text-sm font-medium text-ink">No active invite links</p>
              <p className="mt-1 text-sm text-muted">Create one when you’re ready to add someone.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="members-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="members-heading" className="text-xl font-semibold tracking-tight text-ink">Members</h2>
            <p className="text-sm text-muted">{members.length} total</p>
          </div>
          <ul className="mt-5 divide-y divide-hairline border-t border-hairline">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{member.name}</p>
                  <p className="truncate text-sm text-muted">{member.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-rail px-2.5 py-1 text-xs font-medium capitalize text-muted">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
