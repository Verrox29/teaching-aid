import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';

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
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    evaluatorGroupId: uuid('evaluator_group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    comments: text('comments'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    bySessionIdx: index('evaluations_session_id_idx').on(table.sessionId),
    bySubmissionIdx: index('evaluations_submission_id_idx').on(table.submissionId),
    uniqueEvaluationPerGroup: unique('evaluations_submission_id_evaluator_group_id_uk').on(
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
    score: integer('score').notNull(),
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
