'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db, groupMembers, groups, sessionStudents, sessions } from '@/db';

import {
  studentImportPayloadSchema,
} from './import-utils';

type ImportStudentsActionState = {
  message?: string;
  success?: boolean;
};

const importStudentsFormSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  rowsJson: z.string().min(1, 'No rows to import')
});

const groupedImportStudentSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  schoolEmail: z.string().trim().min(1, 'School email is required').email('School email is invalid')
});

const groupedImportGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required'),
  memberEmails: z.array(z.string().trim().email('School email is invalid')).min(1)
});

const groupedImportPayloadSchema = z.object({
  students: z.array(groupedImportStudentSchema).min(1, 'At least one student is required'),
  groups: z.array(groupedImportGroupSchema)
});

const groupedImportFormSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  payloadJson: z.string().min(1, 'No payload to import')
});

function redirectWithNotice(sessionId: string, message: string): never {
  const searchParams = new URLSearchParams({ notice: message });
  redirect(`/sessions/${sessionId}/evaluation?${searchParams.toString()}`);
}

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

type GroupedImportActionState = {
  message?: string;
  success?: boolean;
};

function uniqueBy<T>(values: T[]) {
  return new Set(values).size === values.length;
}

export async function importBoostcampGroupedStudentsAction(
  _prevState: GroupedImportActionState,
  formData: FormData
): Promise<GroupedImportActionState> {
  const parsedForm = groupedImportFormSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? ''),
    payloadJson: String(formData.get('payloadJson') ?? '')
  });

  if (!parsedForm.success) {
    return {
      success: false,
      message: 'The grouped import payload is invalid. Please try again.'
    };
  }

  const sessionId = parsedForm.data.sessionId;
  const sessionMatch = await db
    .select({
      id: sessions.id,
      defaultGroupCapacity: sessions.defaultGroupCapacity
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (sessionMatch.length === 0) {
    return {
      success: false,
      message: 'Session not found.'
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(parsedForm.data.payloadJson);
  } catch {
    return {
      success: false,
      message: 'Could not read the grouped import payload.'
    };
  }

  const parsedPayload = groupedImportPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return {
      success: false,
      message: 'Please review the grouped import data and try again.'
    };
  }

  const normalizedStudents = parsedPayload.data.students.map((student) => ({
    firstName: student.firstName.trim(),
    lastName: student.lastName.trim(),
    schoolEmail: student.schoolEmail.trim().toLowerCase()
  }));
  const normalizedStudentEmails = normalizedStudents.map((student) => student.schoolEmail);

  if (!uniqueBy(normalizedStudentEmails)) {
    return {
      success: false,
      message: 'Duplicate emails were found in the grouped import rows.'
    };
  }

  const normalizedGroups = parsedPayload.data.groups.map((group) => ({
    name: group.name.trim(),
    memberEmails: group.memberEmails.map((email) => email.trim().toLowerCase())
  }));

  if (!uniqueBy(normalizedGroups.map((group) => group.name))) {
    return {
      success: false,
      message: 'Duplicate group names were found in the grouped import payload.'
    };
  }

  if (!uniqueBy(normalizedGroups.flatMap((group) => group.memberEmails))) {
    return {
      success: false,
      message: 'A student cannot belong to more than one imported group.'
    };
  }

  const groupEmailSet = new Set(normalizedGroups.flatMap((group) => group.memberEmails));
  if ([...groupEmailSet].some((email) => !normalizedStudentEmails.includes(email))) {
    return {
      success: false,
      message: 'One or more imported group members are missing from the student payload.'
    };
  }

  try {
    await db.transaction(async (tx) => {
      const existingStudentRows = await tx
        .select({
          id: sessionStudents.id,
          schoolEmail: sessionStudents.schoolEmail
        })
        .from(sessionStudents)
        .where(
          and(
            eq(sessionStudents.sessionId, sessionId),
            inArray(sessionStudents.schoolEmail, normalizedStudentEmails)
          )
        );

      const studentIdByEmail = new Map<string, string>(
        existingStudentRows.map((student) => [student.schoolEmail.toLowerCase(), student.id])
      );

      for (const student of normalizedStudents) {
        const existingId = studentIdByEmail.get(student.schoolEmail);
        if (existingId) {
          await tx
            .update(sessionStudents)
            .set({
              firstName: student.firstName,
              lastName: student.lastName,
              updatedAt: new Date()
            })
            .where(
              and(eq(sessionStudents.sessionId, sessionId), eq(sessionStudents.id, existingId))
            );
          continue;
        }

        const inserted = await tx
          .insert(sessionStudents)
          .values({
            sessionId,
            firstName: student.firstName,
            lastName: student.lastName,
            schoolEmail: student.schoolEmail
          })
          .returning({
            id: sessionStudents.id,
            schoolEmail: sessionStudents.schoolEmail
          });

        const insertedStudent = inserted[0];
        if (insertedStudent) {
          studentIdByEmail.set(insertedStudent.schoolEmail.toLowerCase(), insertedStudent.id);
        }
      }

      const existingGroupRows = normalizedGroups.length > 0
        ? await tx
            .select({
              id: groups.id,
              name: groups.name,
              capacity: groups.capacity
            })
            .from(groups)
            .where(and(eq(groups.sessionId, sessionId), inArray(groups.name, normalizedGroups.map((group) => group.name))))
        : [];

      const groupIdByName = new Map<string, string>(
        existingGroupRows.map((group) => [group.name, group.id])
      );
      const groupCapacityByName = new Map<string, number>(
        existingGroupRows.map((group) => [group.name, group.capacity])
      );

      for (const group of normalizedGroups) {
        const memberCount = group.memberEmails.length;
        const existingCapacity = groupCapacityByName.get(group.name) ?? 0;
        const capacity = Math.max(existingCapacity, sessionMatch[0].defaultGroupCapacity, memberCount);
        const existingId = groupIdByName.get(group.name);

        if (existingId) {
          await tx
            .update(groups)
            .set({
              capacity,
              updatedAt: new Date()
            })
            .where(and(eq(groups.sessionId, sessionId), eq(groups.id, existingId)));
          continue;
        }

        const inserted = await tx
          .insert(groups)
          .values({
            sessionId,
            name: group.name,
            capacity
          })
          .returning({
            id: groups.id,
            name: groups.name
          });

        const insertedGroup = inserted[0];
        if (insertedGroup) {
          groupIdByName.set(insertedGroup.name, insertedGroup.id);
        }
      }

      const groupIds = [...groupIdByName.values()];
      if (groupIds.length > 0) {
        await tx
          .delete(groupMembers)
          .where(and(eq(groupMembers.sessionId, sessionId), inArray(groupMembers.groupId, groupIds)));
      }

      const importedStudentIds = [...studentIdByEmail.values()];
      if (importedStudentIds.length > 0) {
        await tx
          .delete(groupMembers)
          .where(
            and(
              eq(groupMembers.sessionId, sessionId),
              inArray(groupMembers.sessionStudentId, importedStudentIds)
            )
          );
      }

      const membershipRows = normalizedGroups.flatMap((group) => {
        const groupId = groupIdByName.get(group.name);
        if (!groupId) {
          return [];
        }

        return group.memberEmails.map((schoolEmail) => ({
          sessionId,
          groupId,
          sessionStudentId: studentIdByEmail.get(schoolEmail) ?? ''
        }));
      });

      if (membershipRows.some((row) => !row.sessionStudentId)) {
        throw new Error('One or more imported students could not be matched to a student record.');
      }

      if (membershipRows.length > 0) {
        await tx.insert(groupMembers).values(membershipRows);
      }
    });
  } catch (error) {
    console.error('Failed to import grouped students', error);
    return {
      success: false,
      message: 'Could not apply the grouped import. Please try again.'
    };
  }

  revalidatePath(`/sessions/${sessionId}/students`);
  revalidatePath(`/sessions/${sessionId}/groups`);
  revalidatePath(`/sessions/${sessionId}/evaluation`);
  revalidatePath(`/sessions/${sessionId}/exports`);
  revalidatePath('/sessions');

  return {
    success: true,
    message: 'Grouped import applied. Continue with AI scoring & feedback.'
  };
}
