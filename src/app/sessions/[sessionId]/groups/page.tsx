import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import {
  createDefaultGroupsAction,
  lockGroupSelectionAction,
  unlockGroupSelectionAction
} from './actions';

import { AdminShell } from '@/components/admin-shell';
import { SessionGroupsBoard } from '@/components/session-groups-board';
import { db, sessions } from '@/db';
import { recordSessionAdminPath } from '@/lib/session-navigation';
import { getSessionGroupBoardSnapshot } from '@/lib/session-group-board';

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
  await recordSessionAdminPath(sessionId, `/sessions/${sessionId}/groups`);
  const boardSnapshot = await getSessionGroupBoardSnapshot(sessionId);
  const totalStudents =
    boardSnapshot.groups.reduce((count, group) => count + group.members.length, 0) +
    boardSnapshot.unassignedStudents.length;
  const assignedStudents = boardSnapshot.groups.reduce(
    (count, group) => count + group.members.length,
    0
  );
  const totalSeatsRemaining = boardSnapshot.groups.reduce(
    (count, group) => count + Math.max(0, group.capacity - group.members.length),
    0
  );
  const boardRevision = JSON.stringify({
    groups: boardSnapshot.groups.map((group) => ({
      id: group.id,
      memberCount: group.members.length,
      name: group.name
    })),
    ignored: boardSnapshot.ignoredStudents.map((student) => student.id),
    unassigned: boardSnapshot.unassignedStudents.map((student) => student.id)
  });

  return (
    <AdminShell
      actions={
        <>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}`}>
            Resume
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
      <section className="ui-panel grid gap-5 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Group selection</h2>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              {session.groupSelectionLocked
                ? 'Students can view the public page, but cannot join or switch groups.'
                : 'Students can join or switch groups on the public page.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {session.groupSelectionLocked ? (
              <form action={unlockGroupSelectionAction}>
                <input name="sessionId" type="hidden" value={sessionId} />
                <button className="ui-button ui-button-secondary" type="submit">
                  Unlock group selection
                </button>
              </form>
            ) : (
              <form action={lockGroupSelectionAction}>
                <input name="sessionId" type="hidden" value={sessionId} />
                <button className="ui-button ui-button-secondary" type="submit">
                  Lock group selection
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="ui-card p-4">
            <p className="ui-section-title">Total students</p>
            <p className="mt-2 text-3xl font-semibold">{totalStudents}</p>
          </div>
          <div className="ui-card p-4">
            <p className="ui-section-title">Assigned</p>
            <p className="mt-2 text-3xl font-semibold">{assignedStudents}</p>
          </div>
          <div className="ui-card p-4">
            <p className="ui-section-title">Unassigned</p>
            <p className="mt-2 text-3xl font-semibold">{boardSnapshot.unassignedStudents.length}</p>
          </div>
          <div className="ui-card p-4">
            <p className="ui-section-title">Created groups</p>
            <p className="mt-2 text-3xl font-semibold">{boardSnapshot.groups.length}</p>
          </div>
          <div className="ui-card p-4">
            <p className="ui-section-title">Seats remaining</p>
            <p className="mt-2 text-3xl font-semibold">{totalSeatsRemaining}</p>
          </div>
        </div>
      </section>

      {boardSnapshot.groups.length === 0 ? (
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
        groups={boardSnapshot.groups}
        ignoredStudents={boardSnapshot.ignoredStudents}
        notice={notice}
        sessionId={sessionId}
        sessionTitle={session.title}
        unassignedStudents={boardSnapshot.unassignedStudents}
      />
    </AdminShell>
  );
}
