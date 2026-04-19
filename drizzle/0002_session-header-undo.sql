ALTER TABLE "session_export_metadata" ADD COLUMN "previous_values" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "instructions_previous" text;