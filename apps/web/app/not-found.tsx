import Link from "next/link";
import { buttonStyles } from "@/components/page-header";

/**
 * This is the user-visible half of a security decision, not just a 404 page.
 *
 * lib/guard.ts:requireMember calls notFound() for BOTH "no such group" and "you are not
 * a member", so the two are indistinguishable from the outside. The copy has to stay
 * vague for the same reason: naming the group, or saying "you do not have access", would
 * confirm the group exists to someone who should not know that.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-lg font-semibold text-ink">Not found</h1>
        <p className="mt-2 text-sm text-muted">
          This page does not exist, or you do not have access to it.
        </p>
        <div className="mt-6">
          <Link href="/groups" className={buttonStyles.primary}>
            Back to groups
          </Link>
        </div>
      </div>
    </main>
  );
}
