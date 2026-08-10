import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import {
  BioForm,
  DisplayNameForm,
  PasswordForm,
} from "@/app/(app)/settings/settings-forms";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireSession } from "@/lib/guard";

export default async function SettingsPage() {
  const session = await requireSession();
  const displayName = session.user.name || session.user.email;
  // bio isn't a better-auth session field, so read it from the row directly.
  const [me] = await db
    .select({ bio: user.bio })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  return (
    <main className="min-h-full w-full min-w-0 px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        meta={
          <span className="flex items-center gap-2">
            <Avatar name={displayName} size="sm" />
            <span className="min-w-0 truncate">{session.user.email}</span>
          </span>
        }
      />

      {/* Stacked sections separated by a rule, not side-by-side cards. A single
          column also stops the two forms from setting each other's height. */}
      <div className="max-w-xl pt-8">
        <section className="border-b border-hairline pb-10">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Profile
          </h2>
          <p className="mt-1 text-sm text-muted">
            How you appear to everyone in your groups.
          </p>
          <DisplayNameForm initialName={session.user.name ?? ""} />
          <BioForm initialBio={me?.bio ?? ""} />
        </section>

        <section className="pt-10">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Password
          </h2>
          <p className="mt-1 text-sm text-muted">
            Your email stays {session.user.email}. Changing it isn’t supported yet.
          </p>
          <PasswordForm />
        </section>
      </div>
    </main>
  );
}
