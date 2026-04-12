CREATE TABLE "branching_ai_prompt_templates" (
	"prompt_key" varchar(80) PRIMARY KEY NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"template" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branching_ai_secrets" (
	"key" text PRIMARY KEY NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branching_ai_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"provider" varchar(64) DEFAULT 'openai-compatible' NOT NULL,
	"api_base_url" text,
	"model" varchar(160),
	"timeout_ms" integer DEFAULT 15000 NOT NULL,
	"verification_status" varchar(32) DEFAULT 'not_configured' NOT NULL,
	"last_test_error" text,
	"last_tested_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"rubric_criterion_id" uuid NOT NULL,
	"score" real NOT NULL,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluation_scores_evaluation_id_rubric_criterion_id_uk" UNIQUE("evaluation_id","rubric_criterion_id")
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"submission_id" uuid,
	"evaluator_group_id" uuid NOT NULL,
	"teacher_notes" text,
	"ai_generated_at" timestamp with time zone,
	"ai_last_error" text,
	"ai_recommended_criteria" jsonb,
	"ai_recommended_feedback" jsonb,
	"ai_recommended_questions" jsonb,
	"ai_status" varchar(20) DEFAULT 'idle' NOT NULL,
	"ai_status_updated_at" timestamp with time zone,
	"final_feedback" text,
	"comments" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluations_session_id_evaluator_group_id_uk" UNIQUE("session_id","evaluator_group_id"),
	CONSTRAINT "evaluations_submission_id_evaluator_group_id_uk" UNIQUE("submission_id","evaluator_group_id")
);
--> statement-breakpoint
CREATE TABLE "export_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"requested_by_session_student_id" uuid,
	"export_type" varchar(80) NOT NULL,
	"status" varchar(40) DEFAULT 'completed' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "export_mapping_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(80) NOT NULL,
	"template_version" varchar(80) NOT NULL,
	"mapping_json" jsonb NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "export_mapping_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "export_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"active_template_version" varchar(80),
	"active_mapping_version" varchar(80),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(80) NOT NULL,
	"file_name" varchar(160) NOT NULL,
	"content_base64" text NOT NULL,
	"checksum" varchar(128) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "export_template_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"session_student_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_session_id_session_student_id_uk" UNIQUE("session_id","session_student_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"presentation_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_session_id_name_uk" UNIQUE("session_id","name")
);
--> statement-breakpoint
CREATE TABLE "rubric_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rubric_id" uuid NOT NULL,
	"label" varchar(160) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"max_score" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rubric_criteria_rubric_id_sort_order_uk" UNIQUE("rubric_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"instructions" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_export_metadata" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"programme" varchar(160),
	"class_name" varchar(160),
	"subject" varchar(160),
	"season" varchar(80),
	"professor_name" varchar(160),
	"session_date" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"school_email" varchar(320) NOT NULL,
	"grade_adjustment" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_students_session_id_school_email_uk" UNIQUE("session_id","school_email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" varchar(160) NOT NULL,
	"language" varchar(8) NOT NULL,
	"instructions" text,
	"default_group_capacity" integer NOT NULL,
	"group_count" integer NOT NULL,
	"admin_access_code_hash" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"group_selection_locked" boolean DEFAULT false NOT NULL,
	"group_selection_locked_at" timestamp with time zone,
	"presentation_order_locked" boolean DEFAULT false NOT NULL,
	"presentation_order_locked_at" timestamp with time zone,
	"last_admin_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"rubric_id" uuid,
	"title" varchar(160) NOT NULL,
	"content" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_session_id_group_id_uk" UNIQUE("session_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_rubric_criterion_id_rubric_criteria_id_fk" FOREIGN KEY ("rubric_criterion_id") REFERENCES "public"."rubric_criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluator_group_id_groups_id_fk" FOREIGN KEY ("evaluator_group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_requested_by_session_student_id_session_students_id_fk" FOREIGN KEY ("requested_by_session_student_id") REFERENCES "public"."session_students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_session_student_id_session_students_id_fk" FOREIGN KEY ("session_student_id") REFERENCES "public"."session_students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_rubric_id_rubrics_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_export_metadata" ADD CONSTRAINT "session_export_metadata_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_students" ADD CONSTRAINT "session_students_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_rubric_id_rubrics_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evaluation_scores_evaluation_id_idx" ON "evaluation_scores" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "evaluations_session_id_idx" ON "evaluations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "evaluations_submission_id_idx" ON "evaluations" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "export_history_session_id_idx" ON "export_history" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "export_history_created_at_idx" ON "export_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "export_mapping_versions_version_idx" ON "export_mapping_versions" USING btree ("version");--> statement-breakpoint
CREATE INDEX "export_mapping_versions_template_version_idx" ON "export_mapping_versions" USING btree ("template_version");--> statement-breakpoint
CREATE INDEX "export_template_versions_version_idx" ON "export_template_versions" USING btree ("version");--> statement-breakpoint
CREATE INDEX "group_members_session_id_idx" ON "group_members" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "group_members_group_id_idx" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "groups_session_id_idx" ON "groups" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "rubric_criteria_rubric_id_idx" ON "rubric_criteria" USING btree ("rubric_id");--> statement-breakpoint
CREATE INDEX "rubrics_session_id_idx" ON "rubrics" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_students_session_id_idx" ON "session_students" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sessions_slug_idx" ON "sessions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "submissions_session_id_idx" ON "submissions" USING btree ("session_id");