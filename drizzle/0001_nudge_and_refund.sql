ALTER TABLE "enrollments" ADD COLUMN "nudged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "razorpay_refund_id" text;