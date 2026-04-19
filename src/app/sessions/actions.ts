'use server';

import { randomBytes, scryptSync } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db, sessionExportMetadata, sessions } from '@/db';
import { undoSessionExportMetadata, upsertSessionExportMetadata } from '@/lib/exports/repository';
import { ensurePairagogieRubric } from '@/lib/evaluation/rubric';

const createSessionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  language: z.enum(['fr', 'en'], {
    errorMap: () => ({ message: 'Language is required' })
  }),
  instruction_text: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .optional(),
  default_group_capacity: z.coerce
    .number({
      invalid_type_error: 'Default group capacity is required'
    })
    .int('Default group capacity must be a whole number')
    .positive('Default group capacity must be greater than 0'),
  group_count: z.coerce
    .number({
      invalid_type_error: 'Group count is required'
    })
    .int('Group count must be a whole number')
    .positive('Group count must be greater than 0'),
  admin_access_code: z.string().trim().min(1, 'Admin access code is required')
});

type CreateSessionFormValues = {
  title: string;
  language: 'fr' | 'en';
  instruction_text: string;
  default_group_capacity: string;
  group_count: string;
  admin_access_code: string;
};

export type CreateSessionFormState = {
  errors: Partial<Record<keyof CreateSessionFormValues, string[]>>;
  message?: string;
  values: CreateSessionFormValues;
};

function slugify(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || 'session';
}

async function generateUniqueSlug(title: string) {
  const baseSlug = slugify(title);
  let candidate = baseSlug;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existing = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.slug, candidate))
      .limit(1);

    if (existing.length === 0) {
      return candidate;
    }

    candidate = `${baseSlug}-${randomBytes(2).toString('hex')}`;
  }

  return `${baseSlug}-${randomBytes(4).toString('hex')}`;
}

function hashAdminAccessCode(accessCode: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(accessCode, salt, 64).toString('hex');

  return `scrypt:${salt}:${hash}`;
}

const sessionInstructionsSchema = z.object({
  instructions: z.string().trim().optional().default(''),
  sessionId: z.string().uuid('Invalid session id')
});

const sessionContextSchema = z.object({
  className: z.string().trim().optional().default(''),
  professorName: z.string().trim().optional().default(''),
  programme: z.string().trim().optional().default(''),
  season: z.enum(['Fall', 'Spring']).or(z.literal('')).optional().default(''),
  sessionDate: z.string().trim().optional().default(''),
  subject: z.string().trim().optional().default(''),
  sessionId: z.string().uuid('Invalid session id')
});

async function syncSessionTitleFromSubject(
  sessionId: string,
  subject: string
) {
  const sessionRows = await db
    .select({
      language: sessions.language,
      title: sessions.title
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const session = sessionRows[0] ?? null;
  if (!session) {
    throw new Error('Session not found.');
  }

  const nextTitle = subject.trim() || session.title;
  if (session.title === nextTitle) {
    return;
  }

  await db
    .update(sessions)
    .set({
      title: nextTitle,
      updatedAt: new Date()
    })
    .where(eq(sessions.id, sessionId));
}

function normalizeSessionInstructions(value: string) {
  return value.trim() || null;
}

async function getSessionAdminRoutes(sessionId: string) {
  const sessionRows = await db
    .select({
      slug: sessions.slug
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const session = sessionRows[0] ?? null;
  if (!session) {
    throw new Error('Session not found.');
  }

  return {
    evaluation: `/sessions/${sessionId}/evaluation`,
    exports: `/sessions/${sessionId}/exports`,
    groups: `/sessions/${sessionId}/groups`,
    order: `/sessions/${sessionId}/order`,
    publicPage: `/s/${session.slug}`,
    settings: `/sessions/${sessionId}/exports/settings`,
    students: `/sessions/${sessionId}/students`
  };
}

export async function createSessionAction(
  _prevState: CreateSessionFormState,
  formData: FormData
): Promise<CreateSessionFormState> {
  const rawValues: CreateSessionFormValues = {
    title: String(formData.get('title') ?? ''),
    language: (String(formData.get('language') ?? 'fr') as 'fr' | 'en'),
    instruction_text: String(formData.get('instruction_text') ?? ''),
    default_group_capacity: String(formData.get('default_group_capacity') ?? ''),
    group_count: String(formData.get('group_count') ?? ''),
    admin_access_code: String(formData.get('admin_access_code') ?? '')
  };

  const parsed = createSessionSchema.safeParse(rawValues);

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: 'Please correct the form errors.',
      values: rawValues
    };
  }

  const values = parsed.data;
  const slug = await generateUniqueSlug(values.title);
  const adminAccessCodeHash = hashAdminAccessCode(values.admin_access_code);

  const inserted = await db.insert(sessions).values({
    title: values.title,
    slug,
    language: values.language,
    instructions: values.instruction_text,
    defaultGroupCapacity: values.default_group_capacity,
    groupCount: values.group_count,
    adminAccessCodeHash,
    groupSelectionLocked: false,
    presentationOrderLocked: false
  }).returning({ id: sessions.id });

  const sessionId = inserted[0]?.id;
  if (sessionId) {
    await ensurePairagogieRubric(sessionId);
  }

  revalidatePath('/sessions');
  if (sessionId) {
    redirect(`/sessions/${sessionId}/students?setup=1`);
  }

  redirect('/sessions');
}

export async function saveSessionInstructionsAction(formData: FormData): Promise<void> {
  const parsed = sessionInstructionsSchema.safeParse({
    instructions: String(formData.get('instructions') ?? ''),
    sessionId: String(formData.get('sessionId') ?? '')
  });

  if (!parsed.success) {
    throw new Error('Invalid session brief.');
  }

  const { sessionId, instructions } = parsed.data;
  const sessionRows = await db
    .select({
      instructions: sessions.instructions,
      instructionsPrevious: sessions.instructionsPrevious
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const session = sessionRows[0] ?? null;

  if (!session) {
    throw new Error('Session not found.');
  }

  const nextInstructions = normalizeSessionInstructions(instructions);
  const currentInstructions = session.instructions ?? null;

  if (currentInstructions === nextInstructions) {
    return;
  }

  await db
    .update(sessions)
    .set({
      instructions: nextInstructions,
      instructionsPrevious: currentInstructions,
      updatedAt: new Date()
    })
    .where(eq(sessions.id, sessionId));

  const routes = await getSessionAdminRoutes(sessionId);
  revalidatePath('/sessions');
  revalidatePath(routes.students);
  revalidatePath(routes.groups);
  revalidatePath(routes.order);
  revalidatePath(routes.evaluation);
  revalidatePath(routes.exports);
  revalidatePath(routes.settings);
  revalidatePath(routes.publicPage);
}

export async function saveSessionContextAction(formData: FormData): Promise<void> {
  const parsed = sessionContextSchema.safeParse({
    className: String(formData.get('className') ?? ''),
    professorName: String(formData.get('professorName') ?? ''),
    programme: String(formData.get('programme') ?? ''),
    season: String(formData.get('season') ?? ''),
    sessionDate: String(formData.get('sessionDate') ?? ''),
    sessionId: String(formData.get('sessionId') ?? ''),
    subject: String(formData.get('subject') ?? '')
  });

  if (!parsed.success) {
    throw new Error('Invalid session context.');
  }

  const { sessionId, ...values } = parsed.data;
  await upsertSessionExportMetadata(sessionId, values);
  await syncSessionTitleFromSubject(sessionId, values.subject);

  const routes = await getSessionAdminRoutes(sessionId);
  revalidatePath('/sessions');
  revalidatePath(routes.students);
  revalidatePath(routes.groups);
  revalidatePath(routes.order);
  revalidatePath(routes.evaluation);
  revalidatePath(routes.exports);
  revalidatePath(routes.settings);
  revalidatePath(routes.publicPage);
}

export async function undoSessionContextAction(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      sessionId: z.string().uuid('Invalid session id')
    })
    .safeParse({
      sessionId: String(formData.get('sessionId') ?? '')
    });

  if (!parsed.success) {
    throw new Error('Invalid session context.');
  }

  const { sessionId } = parsed.data;
  const undone = await undoSessionExportMetadata(sessionId);

  if (!undone) {
    throw new Error('Nothing to undo.');
  }

  const metadataRows = await db
    .select({
      subject: sessionExportMetadata.subject
    })
    .from(sessionExportMetadata)
    .where(eq(sessionExportMetadata.sessionId, sessionId))
    .limit(1);
  const restoredSubject = metadataRows[0]?.subject ?? '';
  await syncSessionTitleFromSubject(sessionId, restoredSubject);

  const routes = await getSessionAdminRoutes(sessionId);
  revalidatePath('/sessions');
  revalidatePath(routes.students);
  revalidatePath(routes.groups);
  revalidatePath(routes.evaluation);
  revalidatePath(routes.exports);
  revalidatePath(routes.settings);
  revalidatePath(routes.publicPage);
}

export async function undoSessionInstructionsAction(formData: FormData): Promise<void> {
  const parsed = sessionInstructionsSchema.safeParse({
    instructions: String(formData.get('instructions') ?? ''),
    sessionId: String(formData.get('sessionId') ?? '')
  });

  if (!parsed.success) {
    throw new Error('Invalid session brief.');
  }

  const { sessionId } = parsed.data;
  const sessionRows = await db
    .select({
      instructions: sessions.instructions,
      instructionsPrevious: sessions.instructionsPrevious
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const session = sessionRows[0] ?? null;

  if (!session) {
    throw new Error('Session not found.');
  }

  await db
    .update(sessions)
    .set({
      instructions: session.instructionsPrevious ?? null,
      instructionsPrevious: null,
      updatedAt: new Date()
    })
    .where(eq(sessions.id, sessionId));

  const routes = await getSessionAdminRoutes(sessionId);
  revalidatePath('/sessions');
  revalidatePath(routes.students);
  revalidatePath(routes.groups);
  revalidatePath(routes.evaluation);
  revalidatePath(routes.exports);
  revalidatePath(routes.settings);
  revalidatePath(routes.publicPage);
}
