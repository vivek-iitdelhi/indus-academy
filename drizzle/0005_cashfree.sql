ALTER TABLE "payments" RENAME COLUMN "razorpay_order_id" TO "order_id";--> statement-breakpoint
ALTER TABLE "payments" RENAME COLUMN "razorpay_payment_id" TO "payment_id";--> statement-breakpoint
ALTER TABLE "payments" RENAME COLUMN "razorpay_refund_id" TO "refund_id";--> statement-breakpoint
ALTER TABLE "payments" RENAME CONSTRAINT "payments_razorpay_order_id_unique" TO "payments_order_id_unique";--> statement-breakpoint
ALTER TABLE "payments" RENAME CONSTRAINT "payments_razorpay_payment_id_unique" TO "payments_payment_id_unique";
