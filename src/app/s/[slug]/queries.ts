import { asc, and, eq } from 'drizzle-orm';

import { db, groupMembers, groups, sessionStudents, sessions } from '@/db';

export type PublicSessionRecord = {
  id: string;
  slug: string;
  title: string;
  instructions: string | null;
  groupSelectionLocked: boolean;
};

export type PublicGroupRecord = {
  id: string;
  name: string;
  capacity: number;
  members: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
};

export type SessionStudentRecord = {
  id: string;
  firstName: string;
  lastName: string;
  schoolEmail: string;
};

export async function getSessionBySlug(slug: string): Promise<PublicSessionRecord | null> {
  const rows = await db
    .select({
      id: sessions.id,
      slug: sessions.slug,
      title: sessions.title,
      instructions: sessions.instructions,
      groupSelectionLocked: sessions.groupSelectionLocked
    })
    .from(sessions)
    .where(eq(sessions.slug, slug))
    .limit(1);

  return rows[0] ?? null;
}

export async function getPublicGroupsForSession(sessionId: string): Promise<PublicGroupRecord[]> {
  const groupRows = await db
    .select({
      id: groups.id,
      name: groups.name,
      capacity: groups.capacity
    })
    .from(groups)
    .where(eq(groups.sessionId, sessionId))
    .orderBy(asc(groups.createdAt));

  const membershipRows = await db
    .select({
      groupId: groupMembers.groupId,
      studentId: sessionStudents.id,
      firstName: sessionStudents.firstName,
      lastName: sessionStudents.lastName
    })
    .from(groupMembers)
    .innerJoin(sessionStudents, eq(groupMembers.sessionStudentId, sessionStudents.id))
    .where(eq(groupMembers.sessionId, sessionId))
    .orderBy(asc(sessionStudents.lastName), asc(sessionStudents.firstName));

  const membersByGroup = new Map<string, PublicGroupRecord['members']>();
  for (const member of membershipRows) {
    const current = membersByGroup.get(member.groupId) ?? [];
    current.push({
      id: member.studentId,
      firstName: member.firstName,
      lastName: member.lastName
    });
    membersByGroup.set(member.groupId, current);
  }

  return groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    capacity: group.capacity,
    members: membersByGroup.get(group.id) ?? []
  }));
}

export async function getStudentByEmail(
  sessionId: string,
  schoolEmail: string
): Promise<SessionStudentRecord | null> {
  const rows = await db
    .select({
      id: sessionStudents.id,
      firstName: sessionStudents.firstName,
      lastName: sessionStudents.lastName,
      schoolEmail: sessionStudents.schoolEmail
    })
    .from(sessionStudents)
    .where(
      and(eq(sessionStudents.sessionId, sessionId), eq(sessionStudents.schoolEmail, schoolEmail))
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getStudentById(
  sessionId: string,
  studentId: string
): Promise<SessionStudentRecord | null> {
  const rows = await db
    .select({
      id: sessionStudents.id,
      firstName: sessionStudents.firstName,
      lastName: sessionStudents.lastName,
      schoolEmail: sessionStudents.schoolEmail
    })
    .from(sessionStudents)
    .where(and(eq(sessionStudents.sessionId, sessionId), eq(sessionStudents.id, studentId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function getStudentMembership(
  sessionId: string,
  studentId: string
): Promise<{ groupId: string; groupName: string } | null> {
  const rows = await db
    .select({
      groupId: groupMembers.groupId,
      groupName: groups.name
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.sessionId, sessionId), eq(groupMembers.sessionStudentId, studentId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function getGroupForSession(sessionId: string, groupId: string) {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      capacity: groups.capacity
    })
    .from(groups)
    .where(and(eq(groups.sessionId, sessionId), eq(groups.id, groupId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function getGroupMemberCount(groupId: string) {
  const rows = await db
    .select({
      id: groupMembers.id
    })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  return rows.length;
}
