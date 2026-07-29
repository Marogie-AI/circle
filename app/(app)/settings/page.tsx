import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import {
  DisplayNameForm,
  PasswordForm,
} from "@/app/(app)/settings/settings-forms";
import { requireSession } from "@/lib/guard";

export default async function SettingsPage() {
  const session = await requireSession();
  const displayName = session.user.name || session.user.email;

  return (
    <main className="min-h-screen w-full px-6 py-10 sm:px-10 sm:py-12">
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

      <div className="grid max-w-4xl gap-6 pt-8 md:grid-cols-2">
        <section className="h-fit rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight text-neutral-900">
            Profile
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            How you appear to everyone in your groups.
          </p>
          <DisplayNameForm initialName={session.user.name ?? ""} />
        </section>

        <section className="h-fit rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight text-neutral-900">
            Password
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Your email stays {session.user.email}. Changing it isn’t supported yet.
          </p>
          <PasswordForm />
        </section>
      </div>
    </main>
  );
}
