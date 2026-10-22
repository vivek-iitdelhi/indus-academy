CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"payment_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"held_until" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"company" text,
	"notes" text DEFAULT '' NOT NULL,
	"gstin" text,
	"billing_address" text,
	"amount_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_confirmed_slot_unique" ON "bookings" USING btree ("starts_at") WHERE "bookings"."status" = 'confirmed';--> statement-breakpoint
CREATE INDEX "bookings_starts_at_idx" ON "bookings" USING btree ("starts_at");--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;