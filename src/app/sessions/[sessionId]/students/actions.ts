'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { db, sessionStudents, sessions } from '@/db';

import { studentImportPayloadSchema } from './import-utils';

type ImportStudentsActionState = {
  message?: string;
  success?: boolean;
};

const importStudentsFormSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  rowsJson: z.string().min(1, 'No rows to import')
});

export async function importStudentsAction(
  _prevState: ImportStudentsActionState,
  formData: FormData
): Promise<ImportStudentsActionState> {
  const parsedForm = importStudentsFormSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? ''),
    rowsJson: String(formData.get('rowsJson') ?? '')
  });

  if (!parsedForm.success) {
    return {
      success: false,
      message: 'The import payload is invalid. Please try again.'
    };
  }

  const sessionId = parsedForm.data.sessionId;
  const sessionMatch = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (sessionMatch.length === 0) {
    return {
      success: false,
      message: 'Session not found.'
    };
  }

  let rowsPayload: unknown;

  try {
    rowsPayload = JSON.parse(parsedForm.data.rowsJson);
  } catch {
    return {
      success: false,
      message: 'Could not read the import rows.'
    };
  }

  const parsedPayload = studentImportPayloadSchema.safeParse({
    rows: rowsPayload
  });

  if (!parsedPayload.success || parsedPayload.data.rows.length === 0) {
    return {
      success: false,
      message: 'No valid rows were provided for import.'
    };
  }

  const normalizedRows = parsedPayload.data.rows.map((row) => ({
    userId: row.userId?.trim() ?? '',
    firstName: row.firstName.trim(),
    lastName: row.lastName.trim(),
    schoolEmail: row.schoolEmail.trim().toLowerCase()
  }));

  const emailCounts = new Map<string, number>();
  for (const row of normalizedRows) {
    emailCounts.set(row.schoolEmail, (emailCounts.get(row.schoolEmail) ?? 0) + 1);
  }

  if ([...emailCounts.values()].some((count) => count > 1)) {
    return {
      success: false,
      message: 'Duplicate emails were found in the import rows.'
    };
  }

  const existingStudents = await db
    .select({ schoolEmail: sessionStudents.schoolEmail })
    .from(sessionStudents)
    .where(
      and(
        eq(sessionStudents.sessionId, sessionId),
        inArray(
          sessionStudents.schoolEmail,
          normalizedRows.map((row) => row.schoolEmail)
        )
      )
    );

  if (existingStudents.length > 0) {
    return {
      success: false,
      message: 'One or more student emails already exist in this session.'
    };
  }

  await db.insert(sessionStudents).values(
    normalizedRows.map((row) => ({
      sessionId,
      firstName: row.firstName,
      lastName: row.lastName,
      schoolEmail: row.schoolEmail
    }))
  );

  revalidatePath(`/sessions/${sessionId}/students`);

  return {
    success: true,
    message: `${normalizedRows.length} student${normalizedRows.length > 1 ? 's' : ''} imported successfully.`
  };
}
