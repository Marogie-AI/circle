/**
 * Fetch stock covers for existing posts that have no image of their own.
 *
 * Covers are normally fetched when a post is created or edited (see attachStockCover in
 * app/(app)/groups/[slug]/actions.ts), so anything written before that existed — or
 * inserted straight into the database by a seed script — has none. This fills those in.
 *
 *   bun --env-file=.env.local scripts/backfill-covers.ts            # dry run, shows plan
 *   bun --env-file=.env.local scripts/backfill-covers.ts --apply    # actually writes
 *   bun --env-file=.env.local scripts/backfill-covers.ts --apply --limit 50
 *   bun --env-file=.env.local scripts/backfill-covers.ts --apply --group weekend-readers
 *
 * Deliberately conservative:
 *  - dry run by default, because it makes outbound requests and writes to real rows
 *  - only touches posts where cover_url IS NULL AND og_image IS NULL, so it can never
 *    overwrite a cover or a linked page's own artwork
 *  - stamps cover_fetched_at even on a miss, so re-runs skip posts with no match
 *  - default --limit 200 and a pause between calls, to stay well inside Openverse's
 *    rate limit rather than hammering a free service
 *  - skips the scale-test groups, which hold ~100k rows nobody looks at
 *
 * PRIVACY: each fetch sends keywords derived from the post to api.openverse.org. See
 * stockKeywords in lib/stock-image.ts for exactly what is sent.
 */
import { and, eq, isNull, notLike, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, posts } from "@/db/schema";
import { fetchStockImage, stockImagesEnabled, stockKeywords } from "@/lib/stock-image";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
/**
 * Reads `--flag value`. Checking `includes` first matters: indexOf returns -1 when the
 * flag is absent, so `args[indexOf + 1]` would silently read args[0] — which made
 * `--apply` parse as the limit.
 */
function flagValue(name: string) {
  if (!args.includes(name)) return undefined;
  return args[args.indexOf(name) + 1];
}

const limit = Number(flagValue("--limit") ?? 200);
const groupSlug = flagValue("--group");
/** Openverse is free; leave a gap rather than firing everything at once. */
const DELAY_MS = 350;

if (!Number.isFinite(limit) || limit < 1) {
  console.error("--limit needs a positive number");
  process.exit(1);
}

if (!stockImagesEnabled()) {
  console.error("Covers are disabled (STOCK_IMAGES_DISABLED=1). Nothing to do.");
  process.exit(1);
}

const candidates = await db
  .select({
    id: posts.id,
    title: posts.title,
    tags: posts.tags,
    groupName: groups.name,
  })
  .from(posts)
  .innerJoin(groups, eq(groups.id, posts.groupId))
  .where(
    and(
      eq(posts.status, "published"),
      // Never overwrite an existing cover or a real page image.
      isNull(posts.coverUrl),
      isNull(posts.ogImage),
      // Not already attempted, so a re-run does not re-ask for known misses.
      isNull(posts.coverFetchedAt),
      notLike(groups.slug, "scale-group-%"),
      groupSlug ? eq(groups.slug, groupSlug) : undefined,
    ),
  )
  .orderBy(sql`${posts.createdAt} desc`)
  .limit(limit);

console.log(
  `${candidates.length} post${candidates.length === 1 ? "" : "s"} with no image` +
    (groupSlug ? ` in "${groupSlug}"` : "") +
    (apply ? "" : "  (dry run — pass --apply to write)"),
);

if (!candidates.length) process.exit(0);

let found = 0;
let missed = 0;
let skipped = 0;

for (const post of candidates) {
  const query = stockKeywords(post.title, post.tags);
  const label = `${post.groupName} · ${post.title.slice(0, 48)}`;

  if (!query) {
    skipped++;
    console.log(`  skip   ${label}  (nothing safe to send)`);
    if (apply) {
      await db
        .update(posts)
        .set({ coverFetchedAt: new Date() })
        .where(eq(posts.id, post.id));
    }
    continue;
  }

  if (!apply) {
    console.log(`  would  ${label}  → "${query}"`);
    continue;
  }

  const image = await fetchStockImage(query);
  if (image) {
    found++;
    console.log(`  ok     ${label}  → ${image.authorName} · ${image.licenseName}`);
  } else {
    missed++;
    console.log(`  none   ${label}  → "${query}" (no usable result)`);
  }

  await db
    .update(posts)
    .set({
      coverUrl: image?.url ?? null,
      coverAuthorName: image?.authorName ?? null,
      coverAuthorUrl: image?.authorUrl ?? null,
      coverLicenseName: image?.licenseName ?? null,
      coverLicenseUrl: image?.licenseUrl ?? null,
      coverFetchedAt: new Date(),
    })
    .where(eq(posts.id, post.id));

  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
}

if (apply) {
  console.log(`\n${found} covered, ${missed} no match, ${skipped} skipped.`);
} else {
  console.log("\nDry run. Re-run with --apply to write these.");
}

process.exit(0);
