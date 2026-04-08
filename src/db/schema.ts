import {
  boolean,
  index,
  integer,
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
    adminAccessCodeHash: text('admin_access_code_hash').notNull(),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sessionSlugIdx: index('sessions_slug_idx').on(table.slug)
  })
);

export const students = pgTable(
  'students',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    studentRef: varchar('student_ref', { length: 120 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    bySessionIdx: index('students_session_id_idx').on(table.sessionId),
    uniqueStudentRefInSession: unique('students_session_id_student_ref_uk').on(
      table.sessionId,
      table.studentRef
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

export const groupMemberships = pgTable(
  'group_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    bySessionIdx: index('group_memberships_session_id_idx').on(table.sessionId),
    uniqueStudentGroupInSession: unique('group_memberships_session_id_student_id_uk').on(
      table.sessionId,
      table.studentId
    )
  })
);
