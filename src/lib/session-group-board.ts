import { asc, and, eq } from 'drizzle-orm';

import { db, groupMembers, groups, sessionStudents } from '@/db';

export type SessionGroupBoardStudentRecord = {
  id: string;
  firstName: string;
  lastName: string;
  schoolEmail: string;
};

export type SessionGroupBoardGroupRecord = {
  id: string;
  name: string;
  capacity: number;
  members: SessionGroupBoardStudentRecord[];
};

export type SessionGroupBoardSnapshot = {
  groups: SessionGroupBoardGroupRecord[];
  ignoredStudents: SessionGroupBoardStudentRecord[];
  unassignedStudents: SessionGroupBoardStudentRecord[];
};

function sortStudentsStable(students: SessionGroupBoardStudentRecord[]) {
  return [...students].sort((left, right) => {
    const lastName = left.lastName.localeCompare(right.lastName, 'en', { sensitivity: 'base' });
    if (lastName !== 0) {
      return lastName;
    }

    const firstName = left.firstName.localeCompare(right.firstName, 'en', { sensitivity: 'base' });
    if (firstName !== 0) {
      return firstName;
    }

    return left.schoolEmail.localeCompare(right.schoolEmail, 'en', { sensitivity: 'base' });
  });
}

export async function getSessionGroupBoardSnapshot(
  sessionId: string
): Promise<SessionGroupBoardSnapshot> {
  const [groupRows, visibleMembershipRows, visibleStudentRows, ignoredStudentRows] =
    await Promise.all([
      db
        .select({
          capacity: groups.capacity,
          id: groups.id,
          name: groups.name
        })
        .from(groups)
        .where(eq(groups.sessionId, sessionId))
        .orderBy(asc(groups.createdAt)),
      db
        .select({
          groupId: groupMembers.groupId,
          id: sessionStudents.id,
          firstName: sessionStudents.firstName,
          lastName: sessionStudents.lastName,
          schoolEmail: sessionStudents.schoolEmail
        })
        .from(groupMembers)
        .innerJoin(sessionStudents, eq(groupMembers.sessionStudentId, sessionStudents.id))
        .where(and(eq(groupMembers.sessionId, sessionId), eq(sessionStudents.isIgnored, false)))
        .orderBy(asc(sessionStudents.lastName), asc(sessionStudents.firstName)),
      db
        .select({
          id: sessionStudents.id,
          firstName: sessionStudents.firstName,
          lastName: sessionStudents.lastName,
          schoolEmail: sessionStudents.schoolEmail
        })
        .from(sessionStudents)
        .where(and(eq(sessionStudents.sessionId, sessionId), eq(sessionStudents.isIgnored, false)))
        .orderBy(asc(sessionStudents.lastName), asc(sessionStudents.firstName)),
      db
        .select({
          id: sessionStudents.id,
          firstName: sessionStudents.firstName,
          lastName: sessionStudents.lastName,
          schoolEmail: sessionStudents.schoolEmail
        })
        .from(sessionStudents)
        .where(and(eq(sessionStudents.sessionId, sessionId), eq(sessionStudents.isIgnored, true)))
        .orderBy(asc(sessionStudents.lastName), asc(sessionStudents.firstName))
    ]);

  const membersByGroup = new Map<string, SessionGroupBoardStudentRecord[]>();
  for (const member of visibleMembershipRows) {
    const currentMembers = membersByGroup.get(member.groupId) ?? [];
    currentMembers.push({
      firstName: member.firstName,
      id: member.id,
      lastName: member.lastName,
      schoolEmail: member.schoolEmail
    });
    membersByGroup.set(member.groupId, currentMembers);
  }

  const assignedVisibleStudentIds = new Set(visibleMembershipRows.map((member) => member.id));
  const unassignedStudents = visibleStudentRows.filter(
    (student) => !assignedVisibleStudentIds.has(student.id)
  );

  return {
    groups: groupRows.map((group) => ({
      capacity: group.capacity,
      id: group.id,
      members: sortStudentsStable(membersByGroup.get(group.id) ?? []),
      name: group.name
    })),
    ignoredStudents: sortStudentsStable(ignoredStudentRows),
    unassignedStudents: sortStudentsStable(unassignedStudents)
  };
}
