'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db, groupMembers, groups, sessionStudents, sessions } from '@/db';

const groupsPath = (sessionId: string) => `/sessions/${sessionId}/groups`;

const createGroupsSchema = z.object({
  sessionId: z.string().uuid('Invalid session id')
});

const createGroupSchema = z.object({
  sessionId: z.string().uuid('Invalid session id')
});

const toggleGroupSelectionSchema = z.object({
  sessionId: z.string().uuid('Invalid session id')
});

const updateGroupSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  groupId: z.string().uuid('Invalid group id'),
  name: z.string().trim().min(1, 'Group name is required'),
  capacity: z.coerce
    .number({ invalid_type_error: 'Capacity is required' })
    .int('Capacity must be a whole number')
    .positive('Capacity must be greater than 0')
});

const deleteGroupSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  groupId: z.string().uuid('Invalid group id')
});

const membershipSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  sessionStudentId: z.string().uuid('Invalid student id'),
  groupId: z.string().uuid('Invalid group id')
});

const removeMembershipSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  sessionStudentId: z.string().uuid('Invalid student id')
});

const saveGroupsSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  groupsJson: z.string().min(1, 'Groups payload is required'),
  sourceGroupId: z.string().uuid().optional()
});

const savedGroupSchema = z.object({
  id: z.string().uuid('Invalid group id'),
  name: z.string().trim().min(1, 'Group name is required'),
  capacity: z.coerce
    .number({ invalid_type_error: 'Capacity is required' })
    .int('Capacity must be a whole number')
    .positive('Capacity must be greater than 0'),
  memberIds: z.array(z.string().uuid('Invalid student id'))
});

const savedGroupsPayloadSchema = z.object({
  groups: z.array(savedGroupSchema).min(1, 'At least one group is required')
});

function redirectWithMessage(
  sessionId: string,
  kind: 'notice' | 'error',
  message: string,
  params?: Record<string, string>
): never {
  const searchParams = new URLSearchParams({
    [kind]: message,
    ...(params ?? {})
  });

  redirect(`${groupsPath(sessionId)}?${searchParams.toString()}`);
}

function normalizeText(value: string) {
  return value.trim();
}

function uniqueBy<T>(values: T[]) {
  return new Set(values).size === values.length;
}

async function getSession(sessionId: string) {
  const matches = await db
    .select({
      id: sessions.id,
      slug: sessions.slug,
      title: sessions.title,
      defaultGroupCapacity: sessions.defaultGroupCapacity,
      groupCount: sessions.groupCount,
      groupSelectionLocked: sessions.groupSelectionLocked
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return matches[0] ?? null;
}

async function getGroup(sessionId: string, groupId: string) {
  const matches = await db
    .select({
      id: groups.id,
      sessionId: groups.sessionId,
      name: groups.name,
      capacity: groups.capacity
    })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.sessionId, sessionId)))
    .limit(1);

  return matches[0] ?? null;
}

async function getGroupMemberCount(groupId: string) {
  const rows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  return rows.length;
}

async function getMembership(sessionId: string, sessionStudentId: string) {
  const matches = await db
    .select({
      id: groupMembers.id,
      groupId: groupMembers.groupId,
      sessionStudentId: groupMembers.sessionStudentId
    })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.sessionId, sessionId),
        eq(groupMembers.sessionStudentId, sessionStudentId)
      )
    )
    .limit(1);

  return matches[0] ?? null;
}

async function getStudent(sessionId: string, sessionStudentId: string) {
  const matches = await db
    .select({
      id: sessionStudents.id,
      firstName: sessionStudents.firstName,
      lastName: sessionStudents.lastName,
      schoolEmail: sessionStudents.schoolEmail
    })
    .from(sessionStudents)
    .where(
      and(eq(sessionStudents.id, sessionStudentId), eq(sessionStudents.sessionId, sessionId))
    )
    .limit(1);

  return matches[0] ?? null;
}

async function getNextGroupName(sessionId: string) {
  const rows = await db
    .select({
      name: groups.name
    })
    .from(groups)
    .where(eq(groups.sessionId, sessionId));

  const usedNames = new Set(rows.map((row) => row.name));

  for (let index = 1; index <= rows.length + 25; index += 1) {
    const candidate = `Group ${index}`;
    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }

  return `Group ${rows.length + 1}`;
}

export async function createDefaultGroupsAction(formData: FormData): Promise<never> {
  const parsed = createGroupsSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? '')
  });

  if (!parsed.success) {
    redirectWithMessage('invalid', 'error', 'Invalid session id.');
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Session not found.');
  }

  const existingGroups = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.sessionId, parsed.data.sessionId))
    .limit(1);

  if (existingGroups.length > 0) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Groups already exist for this session.');
  }

  await db.insert(groups).values(
    Array.from({ length: session.groupCount }, (_, index) => ({
      sessionId: parsed.data.sessionId,
      name: `Group ${index + 1}`,
      capacity: session.defaultGroupCapacity
    }))
  );

  revalidatePath(groupsPath(parsed.data.sessionId));
  revalidatePath(`/sessions/${parsed.data.sessionId}/order`);
  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  revalidatePath(`/s/${session.slug}`);
  revalidatePath('/sessions');
  redirectWithMessage(parsed.data.sessionId, 'notice', 'Default groups created.');
}

export async function createGroupAction(formData: FormData): Promise<never> {
  const parsed = createGroupSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? '')
  });

  if (!parsed.success) {
    redirectWithMessage('invalid', 'error', 'Invalid session id.');
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Session not found.');
  }

  const name = await getNextGroupName(parsed.data.sessionId);

  await db.insert(groups).values({
    sessionId: parsed.data.sessionId,
    name,
    capacity: session.defaultGroupCapacity
  });

  revalidatePath(groupsPath(parsed.data.sessionId));
  revalidatePath(`/sessions/${parsed.data.sessionId}/order`);
  revalidatePath(`/sessions/${parsed.data.sessionId}/evaluation`);
  revalidatePath(`/sessions/${parsed.data.sessionId}/exports`);
  revalidatePath('/sessions');
  redirectWithMessage(parsed.data.sessionId, 'notice', `${name} created.`);
}

async function setGroupSelectionLocked(
  formData: FormData,
  locked: boolean
): Promise<never> {
  const parsed = toggleGroupSelectionSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? '')
  });

  if (!parsed.success) {
    redirectWithMessage('invalid', 'error', 'Invalid session id.');
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Session not found.');
  }

  if (session.groupSelectionLocked === locked) {
    redirectWithMessage(
      parsed.data.sessionId,
      'notice',
      locked ? 'Group selection is already locked.' : 'Group selection is already unlocked.'
    );
  }

  await db
    .update(sessions)
    .set({
      groupSelectionLocked: locked,
      groupSelectionLockedAt: locked ? new Date() : null,
      updatedAt: new Date()
    })
    .where(eq(sessions.id, parsed.data.sessionId));

  revalidatePath(groupsPath(parsed.data.sessionId));
  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  revalidatePath(`/s/${session.slug}`);
  revalidatePath(`/s/${session.slug}/join`);
  revalidatePath('/sessions');

  redirectWithMessage(
    parsed.data.sessionId,
    'notice',
    locked ? 'Group selection locked.' : 'Group selection unlocked.'
  );
}

export async function lockGroupSelectionAction(formData: FormData): Promise<never> {
  return setGroupSelectionLocked(formData, true);
}

export async function unlockGroupSelectionAction(formData: FormData): Promise<never> {
  return setGroupSelectionLocked(formData, false);
}

export async function updateGroupAction(formData: FormData): Promise<never> {
  const parsed = updateGroupSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? ''),
    groupId: String(formData.get('groupId') ?? ''),
    name: String(formData.get('name') ?? ''),
    capacity: String(formData.get('capacity') ?? '')
  });

  if (!parsed.success) {
    redirectWithMessage(
      String(formData.get('sessionId') ?? 'invalid'),
      'error',
      'Please correct the group name or capacity.'
    );
  }

  const group = await getGroup(parsed.data.sessionId, parsed.data.groupId);
  if (!group) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Group not found.');
  }

  const duplicateName = await db
    .select({ id: groups.id })
    .from(groups)
    .where(
      and(
        eq(groups.sessionId, parsed.data.sessionId),
        eq(groups.name, parsed.data.name),
        ne(groups.id, parsed.data.groupId)
      )
    )
    .limit(1);

  if (duplicateName.length > 0) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Another group already uses that name.');
  }

  const currentCount = await getGroupMemberCount(parsed.data.groupId);
  if (parsed.data.capacity < currentCount) {
    redirectWithMessage(
      parsed.data.sessionId,
      'error',
      'Capacity cannot be lower than the current member count.'
    );
  }

  await db
    .update(groups)
    .set({
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      updatedAt: new Date()
    })
    .where(and(eq(groups.id, parsed.data.groupId), eq(groups.sessionId, parsed.data.sessionId)));

  revalidatePath(groupsPath(parsed.data.sessionId));
  redirectWithMessage(parsed.data.sessionId, 'notice', 'Group updated.');
}

export async function deleteGroupAction(formData: FormData): Promise<never> {
  const parsed = deleteGroupSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? ''),
    groupId: String(formData.get('groupId') ?? '')
  });

  if (!parsed.success) {
    redirectWithMessage(
      String(formData.get('sessionId') ?? 'invalid'),
      'error',
      'Please choose a valid group to delete.'
    );
  }

  const group = await getGroup(parsed.data.sessionId, parsed.data.groupId);
  if (!group) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Group not found.');
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Session not found.');
  }

  await db.transaction(async (tx) => {
    await tx.delete(groupMembers).where(
      and(
        eq(groupMembers.sessionId, parsed.data.sessionId),
        eq(groupMembers.groupId, parsed.data.groupId)
      )
    );

    await tx.delete(groups).where(
      and(eq(groups.id, parsed.data.groupId), eq(groups.sessionId, parsed.data.sessionId))
    );
  });

  revalidatePath(groupsPath(parsed.data.sessionId));
  revalidatePath(`/sessions/${parsed.data.sessionId}/order`);
  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  revalidatePath(`/s/${session.slug}`);
  revalidatePath('/sessions');
  redirectWithMessage(parsed.data.sessionId, 'notice', 'Group deleted.');
}

export async function assignStudentAction(formData: FormData): Promise<never> {
  const parsed = membershipSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? ''),
    sessionStudentId: String(formData.get('sessionStudentId') ?? ''),
    groupId: String(formData.get('groupId') ?? '')
  });

  if (!parsed.success) {
    redirectWithMessage(
      String(formData.get('sessionId') ?? 'invalid'),
      'error',
      'Please select a valid student and group.'
    );
  }

  const group = await getGroup(parsed.data.sessionId, parsed.data.groupId);
  if (!group) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Group not found.');
  }

  const student = await getStudent(parsed.data.sessionId, parsed.data.sessionStudentId);
  if (!student) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Student not found.');
  }

  const membership = await getMembership(parsed.data.sessionId, parsed.data.sessionStudentId);
  if (membership) {
    redirectWithMessage(
      parsed.data.sessionId,
      'error',
      'That student is already assigned to a group.'
    );
  }

  const currentCount = await getGroupMemberCount(parsed.data.groupId);
  if (currentCount >= group.capacity) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'That group is already full.', {
      errorGroupId: parsed.data.groupId
    });
  }

  await db.insert(groupMembers).values({
    sessionId: parsed.data.sessionId,
    groupId: parsed.data.groupId,
    sessionStudentId: parsed.data.sessionStudentId
  });

  revalidatePath(groupsPath(parsed.data.sessionId));
  redirectWithMessage(parsed.data.sessionId, 'notice', 'Student assigned to the group.');
}

export async function moveStudentAction(formData: FormData): Promise<never> {
  const parsed = membershipSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? ''),
    sessionStudentId: String(formData.get('sessionStudentId') ?? ''),
    groupId: String(formData.get('groupId') ?? '')
  });

  if (!parsed.success) {
    redirectWithMessage(
      String(formData.get('sessionId') ?? 'invalid'),
      'error',
      'Please select a valid destination group.'
    );
  }

  const group = await getGroup(parsed.data.sessionId, parsed.data.groupId);
  if (!group) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Destination group not found.');
  }

  const membership = await getMembership(parsed.data.sessionId, parsed.data.sessionStudentId);
  if (!membership) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Student is not assigned to a group.');
  }

  if (membership.groupId === parsed.data.groupId) {
    redirectWithMessage(parsed.data.sessionId, 'notice', 'Student is already in that group.');
  }

  const currentCount = await getGroupMemberCount(parsed.data.groupId);
  if (currentCount >= group.capacity) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'That destination group is already full.', {
      errorGroupId: parsed.data.groupId
    });
  }

  await db
    .update(groupMembers)
    .set({
      groupId: parsed.data.groupId
    })
    .where(
      and(
        eq(groupMembers.sessionId, parsed.data.sessionId),
        eq(groupMembers.sessionStudentId, parsed.data.sessionStudentId)
      )
    );

  revalidatePath(groupsPath(parsed.data.sessionId));
  redirectWithMessage(parsed.data.sessionId, 'notice', 'Student moved.');
}

export async function removeStudentAction(formData: FormData): Promise<never> {
  const parsed = removeMembershipSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? ''),
    sessionStudentId: String(formData.get('sessionStudentId') ?? '')
  });

  if (!parsed.success) {
    redirectWithMessage(
      String(formData.get('sessionId') ?? 'invalid'),
      'error',
      'Please select a valid student.'
    );
  }

  const membership = await getMembership(parsed.data.sessionId, parsed.data.sessionStudentId);
  if (!membership) {
    const student = await getStudent(parsed.data.sessionId, parsed.data.sessionStudentId);
    if (!student) {
      redirectWithMessage(parsed.data.sessionId, 'error', 'Student not found.');
    }

    redirectWithMessage(
      parsed.data.sessionId,
      'notice',
      `${student.firstName} ${student.lastName} is already unassigned.`,
      {
        errorStudentId: student.id
      }
    );
  }

  await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.sessionId, parsed.data.sessionId),
        eq(groupMembers.sessionStudentId, parsed.data.sessionStudentId)
      )
    );

  revalidatePath(groupsPath(parsed.data.sessionId));
  redirectWithMessage(parsed.data.sessionId, 'notice', 'Student removed from the group.');
}

export async function saveGroupsAction(formData: FormData): Promise<never> {
  const parsed = saveGroupsSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? ''),
    groupsJson: String(formData.get('groupsJson') ?? ''),
    sourceGroupId: String(formData.get('sourceGroupId') ?? '') || undefined
  });

  if (!parsed.success) {
    redirectWithMessage(
      String(formData.get('sessionId') ?? 'invalid'),
      'error',
      'Please review the groups before saving.'
    );
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Session not found.');
  }

  let groupsPayload: unknown;
  try {
    groupsPayload = JSON.parse(parsed.data.groupsJson);
  } catch {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Could not read the groups payload.');
  }

  const parsedGroups = savedGroupsPayloadSchema.safeParse(groupsPayload);
  if (!parsedGroups.success) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Please correct the group data and try again.');
  }

  const existingGroups = await db
    .select({
      id: groups.id
    })
    .from(groups)
    .where(eq(groups.sessionId, parsed.data.sessionId));

  const existingGroupIds = new Set(existingGroups.map((group) => group.id));
  const submittedGroupIds = new Set(parsedGroups.data.groups.map((group) => group.id));

  if (
    existingGroupIds.size !== submittedGroupIds.size ||
    [...existingGroupIds].some((groupId) => !submittedGroupIds.has(groupId))
  ) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'The group list is out of date. Reload the page and try again.');
  }

  const normalizedNames = parsedGroups.data.groups.map((group) => normalizeText(group.name));
  if (!uniqueBy(normalizedNames)) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Group names must be unique.');
  }

  const sessionStudentRows = await db
    .select({
      id: sessionStudents.id
    })
    .from(sessionStudents)
    .where(eq(sessionStudents.sessionId, parsed.data.sessionId));

  const validStudentIds = new Set(sessionStudentRows.map((row) => row.id));
  const memberIds = parsedGroups.data.groups.flatMap((group) => group.memberIds);

  if (!uniqueBy(memberIds)) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'A student can only belong to one group.');
  }

  if (memberIds.some((studentId) => !validStudentIds.has(studentId))) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'One or more students are invalid.');
  }

  for (const group of parsedGroups.data.groups) {
    if (group.memberIds.length > group.capacity) {
      redirectWithMessage(
        parsed.data.sessionId,
        'error',
        'A group capacity cannot be smaller than the number of students in it.'
      );
    }
  }

  try {
    await db.transaction(async (tx) => {
      await Promise.all(
        parsedGroups.data.groups.map((group) =>
          tx
            .update(groups)
            .set({
              name: normalizeText(group.name),
              capacity: group.capacity,
              updatedAt: new Date()
            })
            .where(and(eq(groups.id, group.id), eq(groups.sessionId, parsed.data.sessionId)))
        )
      );

      await tx.delete(groupMembers).where(eq(groupMembers.sessionId, parsed.data.sessionId));

      const memberRows = parsedGroups.data.groups.flatMap((group) =>
        group.memberIds.map((sessionStudentId) => ({
          sessionId: parsed.data.sessionId,
          groupId: group.id,
          sessionStudentId
        }))
      );

      if (memberRows.length > 0) {
        await tx.insert(groupMembers).values(memberRows);
      }
    });
  } catch (error) {
    console.error('Failed to save groups', error);
    redirectWithMessage(
      parsed.data.sessionId,
      'error',
      'Could not save group changes. Please try again.'
    );
  }

  revalidatePath(groupsPath(parsed.data.sessionId));
  redirectWithMessage(
    parsed.data.sessionId,
    'notice',
    parsed.data.sourceGroupId
      ? 'Group changes saved.'
      : 'All group changes saved.'
  );
}
