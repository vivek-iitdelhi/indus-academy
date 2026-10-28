ALTER TABLE "courses" ADD COLUMN "recording_days" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD COLUMN "recording_video_uid" text;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD COLUMN "recording_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_name" text;