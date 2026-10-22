CREATE TABLE "invoice_counters" (
	"fy" text PRIMARY KEY NOT NULL,
	"last" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"order_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"description" text NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text NOT NULL,
	"buyer_phone" text,
	"buyer_gstin" text,
	"buyer_company" text,
	"buyer_address" text,
	"place_of_supply" text NOT NULL,
	"supplier_gstin" text NOT NULL,
	"taxable_paise" integer NOT NULL,
	"cgst_paise" integer NOT NULL,
	"sgst_paise" integer NOT NULL,
	"igst_paise" integer NOT NULL,
	"total_paise" integer NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "invoice_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;