CREATE TABLE "collection_posts" (
	"collection_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"added_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_posts_collection_id_post_id_pk" PRIMARY KEY("collection_id","post_id")
);
--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_posts_collection_idx" ON "collection_posts" USING btree ("collection_id","created_at" desc);--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collections_group_idx" ON "collections" USING btree ("group_id");