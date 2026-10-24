CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"code" text NOT NULL,
	"percent_off" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_course_id_code_unique" UNIQUE("course_id","code")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "coupon_code" text;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;