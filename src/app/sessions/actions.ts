'use server';

import { randomBytes, scryptSync } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db, sessions } from '@/db';

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

  await db.insert(sessions).values({
    title: values.title,
    slug,
    language: values.language,
    instructions: values.instruction_text,
    defaultGroupCapacity: values.default_group_capacity,
    groupCount: values.group_count,
    adminAccessCodeHash,
    groupSelectionLocked: false,
    presentationOrderLocked: false
  });

  revalidatePath('/sessions');
  redirect('/sessions');
}
