CREATE TABLE "batch_payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"paid" boolean NOT NULL,
	"by" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distributor_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"distributor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "distributor_batches_distributor_id_name_unique" UNIQUE("distributor_id","name")
);
--> statement-breakpoint
CREATE TABLE "partner_learners" (
	"distributor_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"user_id" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_learners_distributor_id_external_id_pk" PRIMARY KEY("distributor_id","external_id"),
	CONSTRAINT "partner_learners_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "partner_name" text;--> statement-breakpoint
ALTER TABLE "distributors" ADD COLUMN "certificate_name" text;--> statement-breakpoint
ALTER TABLE "distributors" ADD COLUMN "certificate_release" text DEFAULT 'on_payment' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "batch_payment_events" ADD CONSTRAINT "batch_payment_events_batch_id_distributor_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."distributor_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distributor_batches" ADD CONSTRAINT "distributor_batches_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_learners" ADD CONSTRAINT "partner_learners_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_learners" ADD CONSTRAINT "partner_learners_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_batch_id_distributor_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."distributor_batches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "distributor_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "batch_payment_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "partner_learners" ENABLE ROW LEVEL SECURITY;
