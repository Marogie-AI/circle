import Link from "next/link";
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import {
  createInvite,
  revokeInvite,
  updateGroupDetails,
} from "@/app/(app)/groups/[slug]/actions";
import {
  deleteGroup,
  removeMember,
  setMemberRole,
} from "@/app/(app)/groups/[slug]/member-actions";
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
  const { group, role, user: viewer } = await requireMember(slug);
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
      .orderBy(desc(invites.createdAt))
      .limit(20),
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

      <div className="w-full space-y-10 pt-6 pb-10">
        {role === "owner" ? (
          <section aria-labelledby="about-heading" className="border-b border-hairline pb-10">
            <h2 id="about-heading" className="text-xl font-semibold tracking-tight text-ink">
              About this group
            </h2>
            <p className="mt-2 text-sm text-muted">
              A short description and an optional cover image, shown on the group feed.
            </p>
            <form action={updateGroupDetails.bind(null, slug)} className="mt-5 max-w-2xl space-y-4">
              <div>
                <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-ink">
                  Description <span className="font-normal text-faint">(optional)</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  maxLength={280}
                  defaultValue={group.description ?? ""}
                  placeholder="What is this circle for?"
                  className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10"
                />
              </div>
              <div>
                <label htmlFor="coverUrl" className="mb-1.5 block text-sm font-medium text-ink">
                  Cover image URL <span className="font-normal text-faint">(optional, https)</span>
                </label>
                <input
                  id="coverUrl"
                  name="coverUrl"
                  type="url"
                  defaultValue={group.coverUrl ?? ""}
                  placeholder="https://example.com/cover.jpg"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10"
                />
              </div>
              <SubmitButton
                pendingLabel="Saving…"
                className="rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
              >
                Save details
              </SubmitButton>
            </form>
          </section>
        ) : null}

        {role === "owner" ? (
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
        ) : null}

        <section aria-labelledby="members-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="members-heading" className="text-xl font-semibold tracking-tight text-ink">Members</h2>
            <p className="text-sm text-muted">{members.length} total</p>
          </div>
          <ul className="mt-5 divide-y divide-hairline border-t border-hairline">
            {members.map((member) => {
              const manageable = role === "owner" && member.userId !== viewer.id;
              const nextRole = member.role === "owner" ? "member" : "owner";

              return (
                <li key={member.userId} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{member.name}</p>
                    <p className="truncate text-sm text-muted">{member.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-rail px-2.5 py-1 text-xs font-medium capitalize text-muted">
                      {member.role}
                    </span>
                    {manageable ? (
                      <>
                        <form action={setMemberRole.bind(null, slug, member.userId, nextRole)}>
                          <SubmitButton
                            pendingLabel="Saving…"
                            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
                          >
                            {nextRole === "owner" ? "Make owner" : "Make member"}
                          </SubmitButton>
                        </form>
                        <form action={removeMember.bind(null, slug, member.userId)}>
                          <SubmitButton
                            pendingLabel="Removing…"
                            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
                          >
                            Remove
                          </SubmitButton>
                        </form>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {role === "owner" ? (
          <section aria-labelledby="danger-heading" className="border-t border-hairline pt-10">
            <h2 id="danger-heading" className="text-xl font-semibold tracking-tight text-red-700">
              Danger zone
            </h2>
            <p className="mt-2 text-sm text-muted">
              Deleting a group removes its members, invites, posts and comments. This cannot be undone.
            </p>
            <details className="mt-5">
              <summary className="inline-flex cursor-pointer select-none rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2">
                Delete group
              </summary>
              <form action={deleteGroup.bind(null, slug)} className="mt-4">
                <p className="mb-3 text-sm text-ink">
                  Permanently delete <span className="font-semibold">{group.name}</span>?
                </p>
                <SubmitButton
                  pendingLabel="Deleting…"
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
                >
                  Yes, delete this group
                </SubmitButton>
              </form>
            </details>
          </section>
        ) : null}
      </div>
    </main>
  );
}
