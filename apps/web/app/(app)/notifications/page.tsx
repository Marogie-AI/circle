import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/avatar";
import { MarkSeen } from "@/components/mark-seen";
import { requireSession } from "@/lib/guard";
import {
  listNotifications,
  markAllNotificationsRead,
} from "@/lib/queries/notifications";

// The verb each notification type reads as, dropped between the actor and the subject.
const VERBS: Record<string, string> = {
  comment: "commented on",
  reply: "replied to your comment on",
  reaction: "reacted to",
  new_post: "posted in",
  mention: "mentioned you in",
};

/** "just now" / "5m ago" / "3d ago" — coarse buckets, no dependency. */
function relativeTime(from: Date) {
  const seconds = Math.round((Date.now() - from.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });
  for (const [unit, secs] of units) {
    if (seconds >= secs) return fmt.format(-Math.floor(seconds / secs), unit);
  }
  return "just now";
}

export default async function NotificationsPage() {
  const session = await requireSession();
  const items = await listNotifications(session.user.id);

  return (
    <main className="min-h-full w-full min-w-0 px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      {/* clears the bell badge only after this render has painted */}
      <MarkSeen
        mark={async () => {
          "use server";
          const s = await requireSession();
          await markAllNotificationsRead(s.user.id);
        }}
      />

      <PageHeader eyebrow="Activity" title="Notifications" />

      {items.length ? (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm divide-y divide-hairline">
          {items.map((n) => {
            const verb = VERBS[n.type] ?? "did something in";
            const subject = n.postTitle ?? n.groupName;
            const href = n.postId
              ? `/groups/${n.groupSlug}/p/${n.postId}`
              : `/groups/${n.groupSlug}`;
            return (
              <li key={n.id}>
                <Link
                  href={href}
                  prefetch
                  className={`group flex items-center gap-3 px-5 py-4 transition hover:bg-hover ${
                    n.readAt ? "" : "bg-rail/40"
                  }`}
                >
                  <Avatar name={n.actorName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      <span className="font-medium">{n.actorName}</span>{" "}
                      <span className="text-muted">{verb}</span>{" "}
                      <span className="font-medium">{subject}</span>
                    </p>
                    <p className="truncate text-xs text-muted">in {n.groupName}</p>
                  </div>
                  <time
                    dateTime={n.createdAt.toISOString()}
                    className="shrink-0 whitespace-nowrap text-xs text-faint"
                  >
                    {relativeTime(n.createdAt)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <h2 className="font-semibold tracking-tight text-ink">Nothing yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            When someone comments, reacts, posts or mentions you, it'll show up here.
          </p>
        </div>
      )}
    </main>
  );
}
