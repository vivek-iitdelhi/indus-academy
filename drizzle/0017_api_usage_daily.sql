CREATE TABLE "api_usage_daily" (
	"distributor_id" uuid NOT NULL,
	"day" date NOT NULL,
	"endpoint" text NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_usage_daily_distributor_id_day_endpoint_pk" PRIMARY KEY("distributor_id","day","endpoint")
);
--> statement-breakpoint
ALTER TABLE "api_usage_daily" ADD CONSTRAINT "api_usage_daily_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_daily" ENABLE ROW LEVEL SECURITY;
