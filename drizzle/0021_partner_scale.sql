CREATE TABLE "api_idempotency_keys" (
	"distributor_id" uuid NOT NULL,
	"key" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" integer,
	"response_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_idempotency_keys_distributor_id_key_pk" PRIMARY KEY("distributor_id","key")
);
--> statement-breakpoint
CREATE TABLE "api_rate_limits" (
	"key_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_rate_limits_key_id_window_start_pk" PRIMARY KEY("key_id","window_start")
);
--> statement-breakpoint
CREATE TABLE "distributor_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"distributor_id" uuid NOT NULL,
	"prefix" text NOT NULL,
	"hash" text NOT NULL,
	"label" text,
	"test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "distributor_keys_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "live_attendance_syncs" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"next_page" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_budget" (
	"name" text PRIMARY KEY NOT NULL,
	"tat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_join_links" (
	"webinar_id" text NOT NULL,
	"email" text NOT NULL,
	"url" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"issued" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "live_join_links_webinar_id_email_pk" PRIMARY KEY("webinar_id","email")
);
--> statement-breakpoint
CREATE TABLE "partner_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"distributor_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now(),
	"delivered_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "distributors" ADD COLUMN "rate_limit_per_minute" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "distributors" ADD COLUMN "webhook_url" text;--> statement-breakpoint
ALTER TABLE "distributors" ADD COLUMN "webhook_secret" text;--> statement-breakpoint
ALTER TABLE "distributors" ADD COLUMN "sandbox_of" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "sold_by" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "centre" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "last_played_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partner_learners" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "partner_learners" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_idempotency_keys" ADD CONSTRAINT "api_idempotency_keys_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_rate_limits" ADD CONSTRAINT "api_rate_limits_key_id_distributor_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."distributor_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distributor_keys" ADD CONSTRAINT "distributor_keys_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_attendance_syncs" ADD CONSTRAINT "live_attendance_syncs_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_webhook_events" ADD CONSTRAINT "partner_webhook_events_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_idempotency_keys_created_at_idx" ON "api_idempotency_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "distributor_keys_distributor_id_idx" ON "distributor_keys" USING btree ("distributor_id");--> statement-breakpoint
CREATE INDEX "partner_webhook_events_due_idx" ON "partner_webhook_events" USING btree ("next_attempt_at") WHERE "partner_webhook_events"."next_attempt_at" is not null;--> statement-breakpoint
CREATE INDEX "partner_webhook_events_distributor_id_created_at_idx" ON "partner_webhook_events" USING btree ("distributor_id","created_at");--> statement-breakpoint
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_sandbox_of_distributors_id_fk" FOREIGN KEY ("sandbox_of") REFERENCES "public"."distributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_sandbox_of_unique" UNIQUE("sandbox_of");--> statement-breakpoint
-- Copy each partner's current key into distributor_keys, so the key they use today keeps working
-- now that auth reads only that table. distributors.key_hash/key_prefix stay as they are (NOT NULL UNIQUE); nothing reads them for auth.
INSERT INTO "distributor_keys" ("distributor_id", "prefix", "hash", "label", "test", "created_at", "last_used_at")
SELECT "id", "key_prefix", "key_hash", 'Original key', false, "created_at", "last_used_at"
FROM "distributors" WHERE "sandbox_of" IS NULL
ON CONFLICT ("hash") DO NOTHING;
