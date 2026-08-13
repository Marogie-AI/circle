ALTER TABLE "posts" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "cover_author_name" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "cover_author_url" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "cover_license_name" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "cover_license_url" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "cover_fetched_at" timestamp;