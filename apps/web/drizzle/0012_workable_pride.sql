CREATE TABLE "collection_post_annotations" (
	"collection_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_post_annotations_collection_id_post_id_author_id_pk" PRIMARY KEY("collection_id","post_id","author_id")
);
--> statement-breakpoint
ALTER TABLE "collection_post_annotations" ADD CONSTRAINT "collection_post_annotations_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_post_annotations" ADD CONSTRAINT "collection_post_annotations_collection_post_fk" FOREIGN KEY ("collection_id","post_id") REFERENCES "public"."collection_posts"("collection_id","post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_post_annotations_collection_post_updated_idx" ON "collection_post_annotations" USING btree ("collection_id","post_id","updated_at" desc);