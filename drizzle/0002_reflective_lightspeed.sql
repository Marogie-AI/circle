CREATE TABLE "group_reads" (
	"group_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_reads_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "saved_posts" (
	"user_id" text NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_posts_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "og_title" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "og_description" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "og_image" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "og_site" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "og_fetched_at" timestamp;--> statement-breakpoint
ALTER TABLE "group_reads" ADD CONSTRAINT "group_reads_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_reads" ADD CONSTRAINT "group_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_posts_user_idx" ON "saved_posts" USING btree ("user_id","created_at" desc);--> statement-breakpoint
-- Hand-written: drizzle-kit cannot express a GENERATED ... STORED column.
-- STORED means Postgres maintains it on every insert/update, so there is no trigger to
-- write and no way for the index to drift from the row. Title outranks body via setweight.
ALTER TABLE "posts" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("body",  '')), 'B')
  ) STORED;--> statement-breakpoint
CREATE INDEX "posts_search_idx" ON "posts" USING gin ("search_vector");