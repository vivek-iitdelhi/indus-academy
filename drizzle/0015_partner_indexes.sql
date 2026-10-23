CREATE INDEX "batch_payment_events_batch_id_idx" ON "batch_payment_events" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "enrollments_batch_id_idx" ON "enrollments" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "enrollments_distributor_id_idx" ON "enrollments" USING btree ("distributor_id");