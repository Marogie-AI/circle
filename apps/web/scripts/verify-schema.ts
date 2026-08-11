import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

type Journal = {
  entries: Array<{ tag: string; when: number }>;
};

type IndexExpectation = {
  name: string;
  pattern: RegExp;
};

const requiredIndexes: IndexExpectation[] = [
  { name: "groups_created_by_idx", pattern: /\(created_by\)/ },
  {
    name: "memberships_user_id_idx",
    pattern: /\(user_id, joined_at DESC\)/,
  },
  {
    name: "posts_group_feed_idx",
    pattern: /\(group_id, created_at DESC, id DESC\)/,
  },
  {
    name: "posts_group_author_feed_idx",
    pattern: /\(group_id, author_id, created_at DESC, id DESC\)/,
  },
  {
    name: "posts_author_published_created_idx",
    pattern: /\(author_id, created_at DESC\).*status = 'published'::text/,
  },
  {
    name: "posts_group_pinned_idx",
    pattern:
      /\(group_id, pinned_at DESC\).*status = 'published'::text.*pinned_at IS NOT NULL/,
  },
  { name: "posts_search_idx", pattern: /USING gin \(search_vector\)/ },
  {
    name: "posts_title_trgm_idx",
    pattern: /USING gin \(title gin_trgm_ops\)/,
  },
  {
    name: "collection_post_annotations_collection_post_updated_idx",
    pattern: /\(collection_id, updated_at DESC, author_id DESC\)/,
  },
  {
    name: "notifications_user_unread_idx",
    pattern: /WHERE \(read_at IS NULL\)/,
  },
];

function migrationHash(sql: string) {
  return createHash("sha256").update(sql).digest("hex");
}

async function expectedMigrations() {
  const migrationsDir = join(process.cwd(), "drizzle");
  const journal = JSON.parse(
    await readFile(join(migrationsDir, "meta", "_journal.json"), "utf8"),
  ) as Journal;

  return Promise.all(
    journal.entries.map(async (entry) => ({
      hash: migrationHash(
        await readFile(join(migrationsDir, `${entry.tag}.sql`), "utf8"),
      ),
      createdAt: String(entry.when),
    })),
  );
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  const expected = await expectedMigrations();
  const applied = await client.query<{ hash: string; createdAt: string }>(`
    SELECT hash, created_at::text AS "createdAt"
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at
  `);
  const extensions = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
    ) AS exists
  `);
  const columns = await client.query<{ isGenerated: string }>(`
    SELECT is_generated AS "isGenerated"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'search_vector'
  `);
  const constraints = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'collection_post_annotations_collection_post_fk'
        AND contype = 'f'
    ) AS exists
  `);
  const indexRows = await client.query<{ indexname: string; indexdef: string }>(
    `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
    `,
    [requiredIndexes.map((index) => index.name)],
  );

  assert.deepEqual(applied.rows, expected, "migration ledger differs from drizzle/");
  assert.equal(extensions.rows[0]?.exists, true, "pg_trgm is not installed");
  assert.equal(
    columns.rows[0]?.isGenerated,
    "ALWAYS",
    "posts.search_vector must be a generated column",
  );
  assert.equal(
    constraints.rows[0]?.exists,
    true,
    "collection annotations must retain their composite foreign key",
  );

  const indexes = new Map(indexRows.rows.map((row) => [row.indexname, row.indexdef]));
  for (const expectedIndex of requiredIndexes) {
    const definition = indexes.get(expectedIndex.name);
    assert.ok(definition, `missing ${expectedIndex.name}`);
    assert.match(definition, expectedIndex.pattern, `incorrect ${expectedIndex.name}`);
  }

  console.log(`Verified ${expected.length} migrations and ${requiredIndexes.length} indexes.`);
} finally {
  await client.end();
}
