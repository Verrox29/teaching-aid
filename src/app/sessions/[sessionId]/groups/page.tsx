import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { createDefaultGroupsAction } from './actions';

import { SessionGroupsBoard } from '@/components/session-groups-board';
import { db, groupMembers, groups, sessionStudents, sessions } from '@/db';

type SessionGroupsPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SessionGroupsPage({
  params,
  searchParams
}: SessionGroupsPageProps) {
  const { sessionId } = await params;
  const search = searchParams ? await searchParams : {};
  const notice = getSingleValue(search.notice);
  const error = getSingleValue(search.error);

  const sessionRows = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      defaultGroupCapacity: sessions.defaultGroupCapacity,
      groupCount: sessions.groupCount
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (sessionRows.length === 0) {
    notFound();
  }

  const session = sessionRows[0];

  const groupRows = await db
    .select({
      id: groups.id,
      name: groups.name,
      capacity: groups.capacity,
      createdAt: groups.createdAt
    })
    .from(groups)
    .where(eq(groups.sessionId, sessionId))
    .orderBy(asc(groups.createdAt));

  const membershipRows = await db
    .select({
      id: groupMembers.id,
      groupId: groupMembers.groupId,
      sessionStudentId: sessionStudents.id,
      firstName: sessionStudents.firstName,
      lastName: sessionStudents.lastName,
      schoolEmail: sessionStudents.schoolEmail
    })
    .from(groupMembers)
    .innerJoin(sessionStudents, eq(groupMembers.sessionStudentId, sessionStudents.id))
    .where(eq(groupMembers.sessionId, sessionId))
    .orderBy(asc(sessionStudents.lastName), asc(sessionStudents.firstName));

  const studentRows = await db
    .select({
      id: sessionStudents.id,
      firstName: sessionStudents.firstName,
      lastName: sessionStudents.lastName,
      schoolEmail: sessionStudents.schoolEmail
    })
    .from(sessionStudents)
    .where(eq(sessionStudents.sessionId, sessionId))
    .orderBy(asc(sessionStudents.lastName), asc(sessionStudents.firstName));

  const membersByGroup = new Map<string, typeof membershipRows>();
  for (const member of membershipRows) {
    const currentMembers = membersByGroup.get(member.groupId) ?? [];
    currentMembers.push(member);
    membersByGroup.set(member.groupId, currentMembers);
  }

  const assignedStudentIds = new Set(membershipRows.map((member) => member.sessionStudentId));
  const unassignedStudents = studentRows.filter((student) => !assignedStudentIds.has(student.id));

  const groupsWithMembers = groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    capacity: group.capacity,
    members: membersByGroup.get(group.id) ?? []
  }));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Group management</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {session.title}
          </h1>
          <div className="flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Default capacity: {session.defaultGroupCapacity}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Target groups: {session.groupCount}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Current groups: {groupRows.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
            href={`/sessions/${sessionId}`}
          >
            Session hub
          </a>
          <a
            className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
            href="/sessions"
          >
            Back to sessions
          </a>
        </div>
      </div>

      {groupRows.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900">Create default groups</h2>
            <p className="text-sm text-slate-600">
              No groups exist yet. Create {session.groupCount} groups using the session default
              capacity to start assigning students.
            </p>
          </div>

          <form action={createDefaultGroupsAction} className="mt-4">
            <input name="sessionId" type="hidden" value={sessionId} />
            <button
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              type="submit"
            >
              Create default groups
            </button>
          </form>
        </section>
      ) : null}

      <SessionGroupsBoard
        defaultGroupCapacity={session.defaultGroupCapacity}
        error={error}
        groupCount={session.groupCount}
        groups={groupsWithMembers}
        notice={notice}
        sessionId={sessionId}
        sessionTitle={session.title}
        unassignedStudents={unassignedStudents}
      />
    </main>
  );
}
