ALTER TABLE "partner_learners" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "partner_learners" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "partner_learners" ADD COLUMN "direct_account" boolean DEFAULT false NOT NULL;