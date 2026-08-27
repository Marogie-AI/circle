/**
 * Give every group that has no cover a default banner image, so group pages show a
 * header instead of a blank strip. Covers are otherwise only set by hand in a group's
 * Settings, so groups created before anyone set one have none.
 *
 *   # against production — point DATABASE_URL at prod, then:
 *   DATABASE_URL="postgres://…prod…" bun scripts/backfill-group-covers.ts            # dry run, shows plan
 *   DATABASE_URL="postgres://…prod…" bun scripts/backfill-group-covers.ts --apply    # actually writes
 *   DATABASE_URL="postgres://…prod…" bun scripts/backfill-group-covers.ts --apply --limit 20
 *
 * Deliberately conservative — the same posture as scripts/backfill-covers.ts:
 *  - dry run by DEFAULT. It only writes when you pass --apply, so a bare run against
 *    prod can never change anything.
 *  - only touches groups where cover_url IS NULL. It can never overwrite a cover an
 *    owner chose, and re-running it is a no-op once every group has one.
 *  - deterministic per-group image (keyed on slug), so a group's banner is stable and
 *    a re-run picks the same picture.
 */
import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { groups } from "@/db/schema";

const apply = process.argv.includes("--apply");
const limitArg = process.argv.indexOf("--limit");
const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : undefined;

// Picsum serves a stable image per seed string; keying on slug gives each group its own
// consistent banner without storing an asset or calling an API. 1200x400 matches the
// aspect the group header renders (see app/(app)/groups/[slug]/page.tsx).
const coverFor = (slug: string) => `https://picsum.photos/seed/${slug}/1200/400`;

async function main() {
  const rows = await db
    .select({ id: groups.id, slug: groups.slug, name: groups.name })
    .from(groups)
    .where(isNull(groups.coverUrl))
    .limit(limit ?? 100_000);

  if (rows.length === 0) {
    console.log("No groups without a cover. Nothing to do.");
    return;
  }

  console.log(`${apply ? "Applying" : "DRY RUN"} — ${rows.length} group(s) missing a cover:`);
  for (const g of rows) {
    console.log(`  ${g.slug.padEnd(28)} -> ${coverFor(g.slug)}`);
  }

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to write these.");
    return;
  }

  let written = 0;
  for (const g of rows) {
    await db.update(groups).set({ coverUrl: coverFor(g.slug) }).where(eq(groups.id, g.id));
    written++;
  }
  console.log(`\nDone. Set covers on ${written} group(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
