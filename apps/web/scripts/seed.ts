/**
 * Fill the LOCAL database with a realistic medium dataset for development and QA:
 * ~15 users, 4 groups, ~120 posts, plus threaded comments, likes, collections,
 * saved posts, notifications and unread state.
 *
 *   bun --env-file=.env.local scripts/seed.ts
 *
 * Login-able demo account:  demo@circle.test  /  password123
 *
 * Safe to re-run: it deletes only what it created (the 4 seed groups, users whose
 * id starts with "seed_", and the demo account's personal collections) and never
 * touches your real account or any non-seed group. Refuses to run against a
 * non-local DATABASE_URL so it can never hit production.
 */
import { and, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import {
  collectionPostAnnotations,
  collectionPosts,
  collections,
  comments,
  groupReads,
  groups,
  memberships,
  notifications,
  posts,
  reactions,
  savedPosts,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { LIKE_EMOJI } from "@/lib/post";

// Refuse anything that is not obviously a local database. Seeding truncates and
// rewrites rows; running it against a shared or production URL would be destructive.
const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error(
    `Refusing to seed: DATABASE_URL does not look local (${url || "unset"}).\n` +
      "This script is for the local dev database only.",
  );
  process.exit(1);
}

// ---- deterministic ids so re-runs replace, not duplicate ----------------------
const GROUP_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];
const DEMO_EMAIL = "demo@circle.test";
const DEMO_PASSWORD = "password123";

// ---- tiny content bank (no faker dependency needed) ---------------------------
const FIRST = ["Ada","Bela","Cyrus","Dara","Elio","Farah","Gus","Hana","Iris","Jonah","Kian","Lena","Mira","Noor","Omar","Priya","Quinn","Rafe","Sena","Tariq"];
const LAST = ["Okafor","Nguyen","Silva","Haddad","Kowalski","Mbeki","Rossi","Chen","Dubois","Ivanov","Park","Owusu","Reyes","Ahmed","Ford"];
// Slugs are namespaced with a "seed-" prefix so they never collide with — or delete —
// any real group that already exists in the local database.
const GROUP_DEFS = [
  { name: "Weekend Readers", slug: "seed-weekend-readers", description: "Long reads worth your Saturday morning coffee." },
  { name: "Design Systems", slug: "seed-design-systems", description: "Patterns, tokens, and the war stories behind them." },
  { name: "Home Lab", slug: "seed-home-lab", description: "Self-hosting, homelab racks, and cables we regret." },
  { name: "Trail & Coffee", slug: "seed-trail-and-coffee", description: "Hikes, roasters, and the intersection of both." },
];
const KINDS = ["note", "article", "video", "tool"] as const;
const TITLE_A = ["The quiet case for","Rethinking","A field guide to","Why I stopped","Notes on","The hidden cost of","Building","How we shipped","Against","In defense of"];
const TITLE_B = ["slow software","design tokens","self-hosting","boring technology","the reading habit","dark mode","cold brew","monorepos","trail runs","postgres indexes","weekend projects","typography"];
const BODY = ["Spent the weekend on this and wanted to write it down before I forget the details.","Short version: it worked better than expected, with a couple of sharp edges.","Curious what everyone else does here — my setup feels held together with tape.","Been meaning to share this for a while. Full write-up in the link.","Not a hot take, just something that's been rattling around my head.","Tried three approaches, kept the simplest one, no regrets."];
const TAGS = ["reading","design","selfhosted","postgres","coffee","hiking","tooling","typography","performance","weekend"];
const COMMENTS = ["This matches my experience almost exactly.","Great write-up — the second point especially.","Curious how this holds up at scale?","Saving this for later, thanks for sharing.","Counterpoint: I've had the opposite result.","Which tool did you land on in the end?","+1, been meaning to try this.","The link is gold, appreciate it."];
const URLS = ["https://example.com/read","https://blog.example.dev/post","https://youtube.com/watch?v=demo","https://github.com/example/tool"];

// ---- helpers ------------------------------------------------------------------
const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(a: readonly T[]) => a[rand(a.length)];
const chance = (p: number) => Math.random() < p;
const DAY = 86_400_000;
const now = Date.now();
// A time in the last `maxDays`, at least `minAgoMs` before now (keeps children after parents).
const backDate = (maxDays: number, notAfter = now) =>
  new Date(Math.min(notAfter, now - rand(maxDays * DAY)));
const shuffle = <T>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);

async function main() {
  // 1. Demo account through Better Auth so the password hash lands in `account`.
  let demoId: string;
  const existingDemo = await db.query.user.findFirst({ where: eq(user.email, DEMO_EMAIL) });
  if (existingDemo) {
    demoId = existingDemo.id;
  } else {
    await auth.api.signUpEmail({ body: { name: "Demo User", email: DEMO_EMAIL, password: DEMO_PASSWORD } });
    const created = await db.query.user.findFirst({ where: eq(user.email, DEMO_EMAIL) });
    if (!created) throw new Error("demo signup did not create a user row");
    demoId = created.id;
  }

  // 2. Clear prior seed data. Delete groups first (cascades posts/comments/reactions/
  //    memberships/notifications/group-collections/saved), then demo personal
  //    collections, then plain seed users (now free of references).
  await db
    .delete(groups)
    .where(
      or(
        inArray(groups.id, GROUP_IDS),
        inArray(groups.slug, GROUP_DEFS.map((g) => g.slug)),
      ),
    );
  await db.delete(collections).where(and(eq(collections.userId, demoId), isNull(collections.groupId)));
  await db.delete(user).where(like(user.id, "seed_%"));

  // 3. Plain author users (not login-able — no `account` row).
  const plain = Array.from({ length: 14 }, (_, i) => {
    const name = `${FIRST[i % FIRST.length]} ${pick(LAST)}`;
    return {
      id: `seed_${i + 1}`,
      name,
      email: `seed_${i + 1}@circle.test`,
      emailVerified: true,
      bio: chance(0.6) ? `${pick(["Reader","Builder","Tinkerer","Runner"])} of ${pick(TITLE_B)}.` : null,
      image: `https://i.pravatar.cc/128?u=seed_${i + 1}`,
      createdAt: backDate(60),
    };
  });
  await db.insert(user).values(plain);
  const allUserIds = [demoId, ...plain.map((u) => u.id)];

  // 4. Groups — demo owns the first two, plain users own the rest.
  const owners = [demoId, demoId, plain[0].id, plain[1].id];
  await db.insert(groups).values(
    GROUP_DEFS.map((g, i) => ({
      id: GROUP_IDS[i],
      name: g.name,
      slug: g.slug,
      description: g.description,
      coverUrl: `https://picsum.photos/seed/${g.slug}/1200/400`,
      createdBy: owners[i],
      createdAt: backDate(60),
    })),
  );

  // Optionally add YOUR real account to every seed group so you see the content
  // when logged in as yourself:  SEED_MEMBER_EMAIL=you@example.com bun run db:seed
  let extraMemberId: string | null = null;
  const extraEmail = process.env.SEED_MEMBER_EMAIL;
  if (extraEmail) {
    const found = await db.query.user.findFirst({ where: eq(user.email, extraEmail) });
    if (found) extraMemberId = found.id;
    else console.warn(`SEED_MEMBER_EMAIL "${extraEmail}" not found — skipping.`);
  }

  // 5. Memberships — owner + a random subset; demo (and your account) in every group.
  const groupMembers: Record<string, string[]> = {};
  for (let i = 0; i < GROUP_IDS.length; i++) {
    const gid = GROUP_IDS[i];
    const others = shuffle(allUserIds.filter((id) => id !== owners[i])).slice(0, 9);
    const members = Array.from(
      new Set([owners[i], demoId, ...(extraMemberId ? [extraMemberId] : []), ...others]),
    );
    groupMembers[gid] = members;
    await db.insert(memberships).values(
      members.map((uid) => ({
        groupId: gid,
        userId: uid,
        role: uid === owners[i] ? "owner" : "member",
        joinedAt: backDate(55),
      })),
    );
  }

  // 6. Posts — ~30 per group by random members.
  const postRows: { id: string; groupId: string; authorId: string; createdAt: Date }[] = [];
  for (const gid of GROUP_IDS) {
    const members = groupMembers[gid];
    for (let p = 0; p < 30; p++) {
      const id = crypto.randomUUID();
      const createdAt = backDate(30);
      const withUrl = chance(0.5);
      postRows.push({ id, groupId: gid, authorId: pick(members), createdAt });
      await db.insert(posts).values({
        id,
        groupId: gid,
        authorId: postRows[postRows.length - 1].authorId,
        title: `${pick(TITLE_A)} ${pick(TITLE_B)}`,
        body: `${pick(BODY)}\n\n${pick(BODY)}`,
        url: withUrl ? pick(URLS) : null,
        tags: shuffle([...TAGS]).slice(0, rand(4)),
        status: chance(0.1) ? "draft" : "published",
        kind: pick(KINDS),
        pinnedAt: chance(0.06) ? createdAt : null,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  // 7. Comments (2–6 per post, some threaded) and 8. likes on ~40% of posts.
  let commentCount = 0;
  let reactionCount = 0;
  for (const post of postRows) {
    const members = groupMembers[post.groupId];
    const roots: { id: string; createdAt: Date }[] = [];
    const n = 2 + rand(5);
    for (let c = 0; c < n; c++) {
      const id = crypto.randomUUID();
      const createdAt = backDate(30, now - rand(3 * DAY));
      const parent = roots.length && chance(0.4) ? pick(roots) : null;
      await db.insert(comments).values({
        id,
        postId: post.id,
        authorId: pick(members),
        body: pick(COMMENTS),
        parentId: parent?.id ?? null,
        createdAt: new Date(Math.max(post.createdAt.getTime() + 60_000, createdAt.getTime())),
      });
      if (!parent) roots.push({ id, createdAt });
      commentCount++;
    }
    if (chance(0.4)) {
      const likers = shuffle(members).slice(0, 1 + rand(6));
      for (const uid of likers) {
        // Mostly the current like; a few legacy emojis for count realism.
        const emoji = chance(0.85) ? LIKE_EMOJI : pick(["🔥", "👍"]);
        await db
          .insert(reactions)
          .values({ postId: post.id, userId: uid, emoji, createdAt: backDate(20) })
          .onConflictDoNothing();
        reactionCount++;
      }
    }
  }

  // 9. Collections — a shared one on group 0 and a personal one, both demo's.
  const sharedCollId = crypto.randomUUID();
  const personalCollId = crypto.randomUUID();
  await db.insert(collections).values([
    { id: sharedCollId, userId: demoId, groupId: GROUP_IDS[0], name: "Team picks", createdAt: backDate(20) },
    { id: personalCollId, userId: demoId, groupId: null, name: "Read later", createdAt: backDate(20) },
  ]);
  const group0Posts = shuffle(postRows.filter((p) => p.groupId === GROUP_IDS[0])).slice(0, 6);
  for (const p of group0Posts) {
    await db.insert(collectionPosts).values({ collectionId: sharedCollId, postId: p.id, addedBy: demoId, createdAt: backDate(15) });
    if (chance(0.6)) {
      await db.insert(collectionPostAnnotations).values({
        collectionId: sharedCollId,
        postId: p.id,
        authorId: demoId,
        body: pick(["Worth a second read.", "Good reference for the team.", "This shaped our approach."]),
        createdAt: backDate(14),
        updatedAt: backDate(10),
      });
    }
  }

  // 10. Saved posts — demo bookmarks ~10, some filed in the personal collection,
  //     mix of read/unread/archived.
  const toSave = shuffle(postRows).slice(0, 10);
  await db.insert(savedPosts).values(
    toSave.map((p, i) => ({
      userId: demoId,
      postId: p.id,
      collectionId: i % 3 === 0 ? personalCollId : null,
      readAt: chance(0.4) ? backDate(5) : null,
      archivedAt: chance(0.2) ? backDate(4) : null,
      createdAt: backDate(12),
    })),
  );

  // 11. Notifications for demo — mix of read and unread to light up the badge.
  const notifTypes = ["comment", "reply", "reaction", "new_post"] as const;
  const notifTargets = shuffle(postRows.filter((p) => groupMembers[p.groupId].includes(demoId) && p.authorId !== demoId)).slice(0, 8);
  await db.insert(notifications).values(
    notifTargets.map((p, i) => ({
      userId: demoId,
      actorId: p.authorId,
      type: notifTypes[i % notifTypes.length],
      groupId: p.groupId,
      postId: p.id,
      readAt: i < 3 ? backDate(2) : null, // first 3 read, rest unread
      createdAt: backDate(6),
    })),
  );

  // 12. Group reads — some mid-history (unread badge shows), some current.
  for (const gid of GROUP_IDS) {
    if (!groupMembers[gid].includes(demoId)) continue;
    await db
      .insert(groupReads)
      .values({ groupId: gid, userId: demoId, lastSeenAt: chance(0.5) ? backDate(10) : new Date(now) })
      .onConflictDoNothing();
  }

  // Summary
  const count = async (t: any) => (await db.select({ n: sql<number>`count(*)::int` }).from(t))[0].n;
  console.log("Seed complete:");
  console.log(`  users:         ${await count(user)} (demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD})`);
  console.log(`  groups:        ${GROUP_IDS.length}`);
  console.log(`  posts:         ${postRows.length}`);
  console.log(`  comments:      ${commentCount}`);
  console.log(`  reactions:     ${reactionCount}`);
  console.log(`  saved posts:   ${toSave.length}`);
  console.log(`  notifications: ${notifTargets.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
