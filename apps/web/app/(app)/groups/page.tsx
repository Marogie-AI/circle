import Link from "next/link";
import { createGroup } from "@/app/(app)/actions";
import { PageHeader } from "@/components/page-header";
import { GroupIcon, PlusIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/guard";
import { listGroupsForUser } from "@/lib/queries/groups";

export default async function GroupsPage() {
  const session = await requireSession();
  const userGroups = await listGroupsForUser(session.user.id);

  return (
    <main className="min-h-full w-full min-w-0 px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      <PageHeader
        title="Your groups"
        meta={
          <span>
            {userGroups.length === 1
              ? "1 private space"
              : `${userGroups.length} private spaces`}
            , shared only with their members.
          </span>
        }
      />

      <div className="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          {userGroups.length > 0 ? (
            // Rows, not cards: hierarchy comes from the divider rhythm and a hover
            // tone rather than from twelve floating boxes.
            <ul className="divide-y divide-hairline border-t border-hairline">
              {userGroups.map((group) => (
                <li key={group.id}>
                  <Link
                    href={`/groups/${group.slug}`}
                    prefetch
                    className="group flex items-center gap-3 px-2 py-4 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-inverse text-inverse-ink">
                      <GroupIcon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium tracking-tight text-ink group-hover:underline group-hover:underline-offset-4">
                        {group.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-faint">
                      {group.role}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-rail text-muted">
                <GroupIcon size={22} />
              </span>
              <h2 className="mt-4 font-semibold tracking-tight text-ink">
                No groups yet
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                Create one for the links, notes, and conversations you want to keep
                close — then invite your people with a link.
              </p>
            </div>
          )}
        </section>

        <aside className="h-fit border-t border-hairline pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            New group
          </h2>
          <p className="mt-1 text-sm text-muted">
            You’ll be the owner. Invite friends with a link afterwards.
          </p>
          <form action={createGroup} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="group-name"
                className="mb-1.5 block text-sm font-medium text-ink"
              >
                Group name
              </label>
              <input
                id="group-name"
                name="name"
                type="text"
                required
                minLength={1}
                maxLength={60}
                placeholder="Weekend readers"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10"
              />
            </div>
            <SubmitButton
              pendingLabel="Creating…"
              icon={<PlusIcon size={16} />}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-inverse px-4 py-2.5 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
            >
              Create group
            </SubmitButton>
          </form>
        </aside>
      </div>
    </main>
  );
}
