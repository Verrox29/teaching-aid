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

const updateGroupSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  groupId: z.string().uuid('Invalid group id'),
  name: z.string().trim().min(1, 'Group name is required'),
  capacity: z.coerce
    .number({ invalid_type_error: 'Capacity is required' })
    .int('Capacity must be a whole number')
    .positive('Capacity must be greater than 0')
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

function redirectWithMessage(
  sessionId: string,
  kind: 'notice' | 'error',
  message: string
): never {
  redirect(`${groupsPath(sessionId)}?${kind}=${encodeURIComponent(message)}`);
}

async function getSession(sessionId: string) {
  const matches = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      defaultGroupCapacity: sessions.defaultGroupCapacity,
      groupCount: sessions.groupCount
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
      id: sessionStudents.id
    })
    .from(sessionStudents)
    .where(
      and(eq(sessionStudents.id, sessionStudentId), eq(sessionStudents.sessionId, sessionId))
    )
    .limit(1);

  return matches[0] ?? null;
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
  redirectWithMessage(parsed.data.sessionId, 'notice', 'Default groups created.');
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
    redirectWithMessage(parsed.data.sessionId, 'error', 'That group is already full.');
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
    redirectWithMessage(parsed.data.sessionId, 'error', 'That destination group is already full.');
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
    redirectWithMessage(parsed.data.sessionId, 'error', 'Student is not assigned to a group.');
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
