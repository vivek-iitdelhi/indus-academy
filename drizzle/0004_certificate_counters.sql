CREATE TABLE "certificate_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last" integer NOT NULL
);
--> statement-breakpoint
DROP SEQUENCE "public"."certificate_serial_seq";--> statement-breakpoint
-- Carry on from certificates already issued (serial IAA-<year>-<n>).
INSERT INTO "certificate_counters" ("year", "last")
SELECT split_part("serial", '-', 2)::int, max(split_part("serial", '-', 3)::int) FROM "certificates" GROUP BY 1;
