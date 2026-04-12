import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';

import type {
  EvaluationAiCriterionRecommendation,
  EvaluationAiFeedbackSections
} from '@/lib/evaluation/types';
import type { PairagogieExportMapping } from '@/lib/exports/types';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: varchar('slug', { length: 80 }).notNull().unique(),
    title: varchar('title', { length: 160 }).notNull(),
    language: varchar('language', { length: 8 }).notNull(),
    instructions: text('instructions'),
    defaultGroupCapacity: integer('default_group_capacity').notNull(),
    groupCount: integer('group_count').notNull(),
    adminAccessCodeHash: text('admin_access_code_hash').notNull(),
    isPublished: boolean('is_published').notNull().default(false),
    groupSelectionLocked: boolean('group_selection_locked').notNull().default(false),
    groupSelectionLockedAt: timestamp('group_selection_locked_at', { withTimezone: true }),
    presentationOrderLocked: boolean('presentation_order_locked').notNull().default(false),
    presentationOrderLockedAt: timestamp('presentation_order_locked_at', { withTimezone: true }),
    lastAdminPath: text('last_admin_path'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sessionSlugIdx: index('sessions_slug_idx').on(table.slug)
  })
);

export const sessionStudents = pgTable(
  'session_students',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    firstName: varchar('first_name', { length: 120 }).notNull(),
    lastName: varchar('last_name', { length: 120 }).notNull(),
    schoolEmail: varchar('school_email', { length: 320 }).notNull(),
    gradeAdjustment: real('grade_adjustment').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    bySessionIdx: index('session_students_session_id_idx').on(table.sessionId),
    uniqueStudentEmailInSession: unique('session_students_session_id_school_email_uk').on(
      table.sessionId,
      table.schoolEmail
    )
  })
);

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    capacity: integer('capacity').notNull().default(1),
    presentationOrder: integer('presentation_order'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    bySessionIdx: index('groups_session_id_idx').on(table.sessionId),
    uniqueGroupNameInSession: unique('groups_session_id_name_uk').on(
      table.sessionId,
      table.name
    )
  })
);

export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    sessionStudentId: uuid('session_student_id')
      .notNull()
      .references(() => sessionStudents.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    bySessionIdx: index('group_members_session_id_idx').on(table.sessionId),
    byGroupIdx: index('group_members_group_id_idx').on(table.groupId),
    uniqueStudentPerSession: unique('group_members_session_id_session_student_id_uk').on(
      table.sessionId,
      table.sessionStudentId
    )
  })
);

export const rubrics = pgTable(
  'rubrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 160 }).notNull(),
    instructions: text('instructions'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    bySessionIdx: index('rubrics_session_id_idx').on(table.sessionId)
  })
);

export const rubricCriteria = pgTable(
  'rubric_criteria',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    rubricId: uuid('rubric_id')
      .notNull()
      .references(() => rubrics.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 160 }).notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    maxScore: integer('max_score').notNull().default(5),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    byRubricIdx: index('rubric_criteria_rubric_id_idx').on(table.rubricId),
    uniqueSortOrderPerRubric: unique('rubric_criteria_rubric_id_sort_order_uk').on(
      table.rubricId,
      table.sortOrder
    )
  })
);

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    rubricId: uuid('rubric_id').references(() => rubrics.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 160 }).notNull(),
    content: text('content'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    bySessionIdx: index('submissions_session_id_idx').on(table.sessionId),
    uniqueSubmissionPerGroup: unique('submissions_session_id_group_id_uk').on(
      table.sessionId,
      table.groupId
    )
  })
);

export const evaluations = pgTable(
  'evaluations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    submissionId: uuid('submission_id').references(() => submissions.id, { onDelete: 'cascade' }),
    evaluatorGroupId: uuid('evaluator_group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    teacherNotes: text('teacher_notes'),
    aiGeneratedAt: timestamp('ai_generated_at', { withTimezone: true }),
    aiLastError: text('ai_last_error'),
    aiRecommendedCriteria: jsonb('ai_recommended_criteria').$type<
      EvaluationAiCriterionRecommendation[] | null
    >(),
    aiRecommendedFeedback: jsonb('ai_recommended_feedback').$type<
      EvaluationAiFeedbackSections | null
    >(),
    aiRecommendedQuestions: jsonb('ai_recommended_questions').$type<string[] | null>(),
    aiStatus: varchar('ai_status', { length: 20 }).notNull().default('idle'),
    aiStatusUpdatedAt: timestamp('ai_status_updated_at', { withTimezone: true }),
    finalFeedback: text('final_feedback'),
    comments: text('comments'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    bySessionIdx: index('evaluations_session_id_idx').on(table.sessionId),
    bySubmissionIdx: index('evaluations_submission_id_idx').on(table.submissionId),
    uniqueEvaluationPerSessionGroup: unique('evaluations_session_id_evaluator_group_id_uk').on(
      table.sessionId,
      table.evaluatorGroupId
    ),
    uniqueEvaluationPerSubmissionGroup: unique('evaluations_submission_id_evaluator_group_id_uk').on(
      table.submissionId,
      table.evaluatorGroupId
    )
  })
);

export const evaluationScores = pgTable(
  'evaluation_scores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    evaluationId: uuid('evaluation_id')
      .notNull()
      .references(() => evaluations.id, { onDelete: 'cascade' }),
    rubricCriterionId: uuid('rubric_criterion_id')
      .notNull()
      .references(() => rubricCriteria.id, { onDelete: 'cascade' }),
    score: real('score').notNull(),
    feedback: text('feedback'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    byEvaluationIdx: index('evaluation_scores_evaluation_id_idx').on(table.evaluationId),
    uniqueCriterionPerEvaluation: unique('evaluation_scores_evaluation_id_rubric_criterion_id_uk').on(
      table.evaluationId,
      table.rubricCriterionId
    )
  })
);

export const exportHistory = pgTable(
  'export_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    requestedBySessionStudentId: uuid('requested_by_session_student_id').references(
      () => sessionStudents.id,
      { onDelete: 'set null' }
    ),
    exportType: varchar('export_type', { length: 80 }).notNull(),
    status: varchar('status', { length: 40 }).notNull().default('completed'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true })
  },
  (table) => ({
    bySessionIdx: index('export_history_session_id_idx').on(table.sessionId),
    byCreatedAtIdx: index('export_history_created_at_idx').on(table.createdAt)
  })
);

export const exportTemplateVersions = pgTable(
  'export_template_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    version: varchar('version', { length: 80 }).notNull().unique(),
    fileName: varchar('file_name', { length: 160 }).notNull(),
    contentBase64: text('content_base64').notNull(),
    checksum: varchar('checksum', { length: 128 }).notNull(),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    byVersionIdx: index('export_template_versions_version_idx').on(table.version)
  })
);

export const exportMappingVersions = pgTable(
  'export_mapping_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    version: varchar('version', { length: 80 }).notNull().unique(),
    templateVersion: varchar('template_version', { length: 80 }).notNull(),
    mappingJson: jsonb('mapping_json').$type<PairagogieExportMapping>().notNull(),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    byVersionIdx: index('export_mapping_versions_version_idx').on(table.version),
    byTemplateVersionIdx: index('export_mapping_versions_template_version_idx').on(
      table.templateVersion
    )
  })
);

export const exportSettings = pgTable('export_settings', {
  key: text('key').primaryKey(),
  activeTemplateVersion: varchar('active_template_version', { length: 80 }),
  activeMappingVersion: varchar('active_mapping_version', { length: 80 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const branchingAiSettings = pgTable('branching_ai_settings', {
  key: text('key').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  provider: varchar('provider', { length: 64 }).notNull().default('openai-compatible'),
  apiBaseUrl: text('api_base_url'),
  model: varchar('model', { length: 160 }),
  timeoutMs: integer('timeout_ms').notNull().default(15000),
  verificationStatus: varchar('verification_status', { length: 32 })
    .notNull()
    .default('not_configured'),
  lastTestError: text('last_test_error'),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const branchingAiSecrets = pgTable('branching_ai_secrets', {
  key: text('key').primaryKey(),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const branchingAiPromptTemplates = pgTable('branching_ai_prompt_templates', {
  promptKey: varchar('prompt_key', { length: 80 }).primaryKey(),
  title: varchar('title', { length: 160 }).notNull(),
  description: text('description').notNull(),
  template: text('template').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const sessionExportMetadata = pgTable('session_export_metadata', {
  sessionId: uuid('session_id')
    .primaryKey()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  programme: varchar('programme', { length: 160 }),
  className: varchar('class_name', { length: 160 }),
  subject: varchar('subject', { length: 160 }),
  season: varchar('season', { length: 80 }),
  professorName: varchar('professor_name', { length: 160 }),
  sessionDate: varchar('session_date', { length: 80 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
