-- gin_trgm_ops lives in the pg_trgm extension. Without this the CREATE INDEX below fails
-- on a fresh database with: operator class "gin_trgm_ops" does not exist.
-- drizzle-kit does not generate extension statements, so this line is written by hand and
-- must survive any regeneration of this file. pg_trgm is available on Neon.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
-- Plain CREATE INDEX rather than CONCURRENTLY: drizzle-kit runs each migration inside a
-- transaction, and CONCURRENTLY cannot run in one. This takes a brief write lock on posts.
CREATE INDEX "posts_title_trgm_idx" ON "posts" USING gin ("title" gin_trgm_ops);
