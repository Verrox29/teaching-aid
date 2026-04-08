import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import {
  assignStudentAction,
  createDefaultGroupsAction,
  moveStudentAction,
  removeStudentAction,
  updateGroupAction
} from './actions';

import { db, groupMembers, groups, sessionStudents, sessions } from '@/db';

type SessionGroupsPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function StatusBanner({
  notice,
  error
}: {
  notice?: string;
  error?: string;
}) {
  if (!notice && !error) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        error
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      {error ?? notice}
    </div>
  );
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
    const existing = membersByGroup.get(member.groupId) ?? [];
    existing.push(member);
    membersByGroup.set(member.groupId, existing);
  }

  const assignedStudentIds = new Set(membershipRows.map((member) => member.sessionStudentId));
  const unassignedStudents = studentRows.filter((student) => !assignedStudentIds.has(student.id));
  const hasGroups = groupRows.length > 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Session groups</p>
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
          <Link
            className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
            href={`/sessions/${sessionId}`}
          >
            Session hub
          </Link>
          <Link
            className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
            href="/sessions"
          >
            Back to sessions
          </Link>
        </div>
      </div>

      <StatusBanner notice={notice} error={error} />

      {!hasGroups ? (
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="grid gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-900">Groups</h2>
            <p className="text-sm text-slate-600">
              Edit names and capacities, move students between groups, or remove them entirely.
            </p>
          </div>

          {groupRows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Create the default groups to begin managing memberships.
            </div>
          ) : (
            <div className="grid gap-4">
              {groupRows.map((group) => {
                const members = membersByGroup.get(group.id) ?? [];
                const remainingSeats = group.capacity - members.length;

                return (
                  <article
                    key={group.id}
                    className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{group.name}</h3>
                        <p className="text-sm text-slate-600">
                          Capacity {group.capacity} · {members.length} member
                          {members.length === 1 ? '' : 's'} ·{' '}
                          {remainingSeats >= 0
                            ? `${remainingSeats} seat${remainingSeats === 1 ? '' : 's'} left`
                            : `Over capacity by ${Math.abs(remainingSeats)}`}
                        </p>
                      </div>
                    </div>

                    <form action={updateGroupAction} className="grid gap-3 rounded-lg bg-slate-50 p-4">
                      <input name="sessionId" type="hidden" value={sessionId} />
                      <input name="groupId" type="hidden" value={group.id} />
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]">
                        <label className="grid gap-1 text-sm font-medium text-slate-700">
                          Group name
                          <input
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                            defaultValue={group.name}
                            name="name"
                            type="text"
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-medium text-slate-700">
                          Capacity
                          <input
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                            defaultValue={group.capacity}
                            min="1"
                            name="capacity"
                            type="number"
                          />
                        </label>
                        <div className="flex items-end">
                          <button
                            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
                            type="submit"
                          >
                            Save group
                          </button>
                        </div>
                      </div>
                    </form>

                    <div className="grid gap-3">
                      <div className="text-sm font-medium text-slate-900">Members</div>
                      {members.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                          No students in this group yet.
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {members.map((member) => (
                            <div
                              key={member.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3"
                            >
                              <div>
                                <div className="text-sm font-medium text-slate-900">
                                  {member.firstName} {member.lastName}
                                </div>
                                <div className="text-sm text-slate-500">{member.schoolEmail}</div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <form action={moveStudentAction} className="flex items-center gap-2">
                                  <input name="sessionId" type="hidden" value={sessionId} />
                                  <input
                                    name="sessionStudentId"
                                    type="hidden"
                                    value={member.sessionStudentId}
                                  />
                                  <select
                                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                    defaultValue={member.groupId}
                                    name="groupId"
                                  >
                                    {groupRows.map((destinationGroup) => (
                                      <option key={destinationGroup.id} value={destinationGroup.id}>
                                        {destinationGroup.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                    type="submit"
                                  >
                                    Move
                                  </button>
                                </form>

                                <form action={removeStudentAction}>
                                  <input name="sessionId" type="hidden" value={sessionId} />
                                  <input
                                    name="sessionStudentId"
                                    type="hidden"
                                    value={member.sessionStudentId}
                                  />
                                  <button
                                    className="rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                                    type="submit"
                                  >
                                    Remove
                                  </button>
                                </form>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="grid gap-4">
          <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Unassigned students</h2>
              <p className="text-sm text-slate-600">
                Students not yet placed in any group for this session.
              </p>
            </div>

            {unassignedStudents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                All students are assigned to groups.
              </div>
            ) : hasGroups ? (
              <div className="grid gap-3">
                {unassignedStudents.map((student) => (
                  <div
                    key={student.id}
                    className="grid gap-3 rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {student.firstName} {student.lastName}
                      </div>
                      <div className="text-sm text-slate-500">{student.schoolEmail}</div>
                    </div>
                    <form action={assignStudentAction} className="flex flex-wrap items-center gap-2">
                      <input name="sessionId" type="hidden" value={sessionId} />
                      <input name="sessionStudentId" type="hidden" value={student.id} />
                      <select
                        className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        defaultValue={groupRows[0]?.id}
                        name="groupId"
                      >
                        {groupRows.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        type="submit"
                      >
                        Assign
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                Create groups first to assign students.
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Session overview</h2>
              <p className="text-sm text-slate-600">Current roster and group settings.</p>
            </div>

            <dl className="mt-4 grid gap-3 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
                <dt className="text-slate-500">Total students</dt>
                <dd className="font-medium text-slate-900">{studentRows.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
                <dt className="text-slate-500">Assigned</dt>
                <dd className="font-medium text-slate-900">{membershipRows.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
                <dt className="text-slate-500">Unassigned</dt>
                <dd className="font-medium text-slate-900">{unassignedStudents.length}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
