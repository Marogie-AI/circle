DROP INDEX "collection_post_annotations_collection_post_updated_idx";--> statement-breakpoint
DROP INDEX "memberships_user_id_idx";--> statement-breakpoint
CREATE INDEX "groups_created_by_idx" ON "groups" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "posts_author_published_created_idx" ON "posts" USING btree ("author_id","created_at" desc) WHERE "posts"."status" = 'published';--> statement-breakpoint
CREATE INDEX "posts_group_pinned_idx" ON "posts" USING btree ("group_id","pinned_at" desc) WHERE "posts"."status" = 'published' and "posts"."pinned_at" is not null;--> statement-breakpoint
CREATE INDEX "collection_post_annotations_collection_post_updated_idx" ON "collection_post_annotations" USING btree ("collection_id","updated_at" desc,"author_id" desc);--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id","joined_at" desc);