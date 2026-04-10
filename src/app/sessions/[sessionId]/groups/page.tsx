import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import {
  createDefaultGroupsAction,
  lockGroupSelectionAction,
  unlockGroupSelectionAction
} from './actions';

import { AdminShell } from '@/components/admin-shell';
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
  const errorStudentId = getSingleValue(search.errorStudentId);
  const errorGroupId = getSingleValue(search.errorGroupId);

  const sessionRows = await db
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

  if (sessionRows.length === 0) {
    notFound();
  }

  const session = sessionRows[0];

  const groupRows = await db
    .select({
      id: groups.id,
      name: groups.name,
      capacity: groups.capacity,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt
    })
    .from(groups)
    .where(eq(groups.sessionId, sessionId))
    .orderBy(asc(groups.createdAt));

  const membershipRows = await db
    .select({
      id: sessionStudents.id,
      groupId: groupMembers.groupId,
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

  const assignedStudentIds = new Set(membershipRows.map((member) => member.id));
  const unassignedStudents = studentRows.filter((student) => !assignedStudentIds.has(student.id));

  const groupsWithMembers = groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    capacity: group.capacity,
    members: membersByGroup.get(group.id) ?? []
  }));
  const boardRevision = JSON.stringify(
    groupRows.map((group) => ({
      id: group.id,
      updatedAt: group.updatedAt.toISOString(),
      memberCount: membersByGroup.get(group.id)?.length ?? 0
    }))
  );

  return (
    <AdminShell
      actions={
        <>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}`}>
            Session hub
          </Link>
          <Link className="ui-button ui-button-secondary" href={`/s/${session.slug}`}>
            Public page
          </Link>
          <Link className="ui-button ui-button-primary" href="/sessions">
            Sessions list
          </Link>
        </>
      }
      currentStep={2}
      description="Create, rename, resize, and manage session groups."
      sessionId={sessionId}
      slug={session.slug}
      subtitle="Group creation"
      title={session.title}
    >
      <section className="flex flex-wrap items-center justify-between gap-3 ui-panel px-4 py-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Group selection</h2>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            {session.groupSelectionLocked
              ? 'Students can view the public page, but cannot join or switch groups.'
              : 'Students can join or switch groups on the public page.'}
          </p>
        </div>

        {session.groupSelectionLocked ? (
          <form action={unlockGroupSelectionAction}>
            <input name="sessionId" type="hidden" value={sessionId} />
            <button
              className="ui-button ui-button-secondary"
              type="submit"
            >
              Unlock group selection
            </button>
          </form>
        ) : (
          <form action={lockGroupSelectionAction}>
            <input name="sessionId" type="hidden" value={sessionId} />
            <button
              className="ui-button ui-button-secondary"
              type="submit"
            >
              Lock group selection
            </button>
          </form>
        )}
      </section>

      {groupRows.length === 0 ? (
        <section className="ui-panel p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Create default groups</h2>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              No groups exist yet. Create {session.groupCount} groups using the session default
              capacity to start assigning students.
            </p>
          </div>

          <form action={createDefaultGroupsAction} className="mt-4">
            <input name="sessionId" type="hidden" value={sessionId} />
            <button
              className="ui-button ui-button-primary"
              type="submit"
            >
              Create default groups
            </button>
          </form>
        </section>
      ) : null}

      <SessionGroupsBoard
        key={boardRevision}
        defaultGroupCapacity={session.defaultGroupCapacity}
        error={error}
        errorGroupId={errorGroupId}
        errorStudentId={errorStudentId}
        groupCount={session.groupCount}
        groups={groupsWithMembers}
        notice={notice}
        sessionId={sessionId}
        sessionTitle={session.title}
        unassignedStudents={unassignedStudents}
      />
    </AdminShell>
  );
}
