import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminTimelineNav } from '@/components/admin-timeline-nav';
import { db, groupMembers, groups, sessionStudents, sessions } from '@/db';

type SessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = await params;
  const rows = await db
    .select({
      id: sessions.id,
      slug: sessions.slug,
      title: sessions.title,
      language: sessions.language,
      defaultGroupCapacity: sessions.defaultGroupCapacity,
      groupCount: sessions.groupCount,
      groupSelectionLocked: sessions.groupSelectionLocked
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const session = rows[0] ?? null;

  if (!session) {
    notFound();
  }

  const studentRows = await db
    .select({ id: sessionStudents.id })
    .from(sessionStudents)
    .where(eq(sessionStudents.sessionId, sessionId));

  const membershipRows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.sessionId, sessionId));

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

  const assignedCount = membershipRows.length;
  const totalStudents = studentRows.length;
  const unassignedCount = Math.max(0, totalStudents - assignedCount);
  const membersByGroup = new Map<string, number>();
  for (const member of membershipRows) {
    membersByGroup.set(member.groupId, (membersByGroup.get(member.groupId) ?? 0) + 1);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
      <AdminTimelineNav currentStep={3} sessionId={sessionId} slug={session.slug} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Group enrolment</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {session?.title ?? sessionId}
          </h1>
          <div className="flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1">Language: {session.language}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Default capacity: {session.defaultGroupCapacity}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Target groups: {session.groupCount}
            </span>
            <span
              className={`rounded-full px-3 py-1 ${
                session.groupSelectionLocked
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {session.groupSelectionLocked ? 'Group selection locked' : 'Group selection open'}
            </span>
          </div>
        </div>

        <Link
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          href="/sessions"
        >
          Back to sessions
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Students</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalStudents}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Assigned</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{assignedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Unassigned</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{unassignedCount}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Enrolment status</h2>
          <p className="text-sm text-slate-600">
            Use the group creation page to edit groups and capacities, then monitor the final
            enrolment state here.
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {groupRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
              No groups have been created yet.
            </div>
          ) : (
            groupRows.map((group) => {
              const memberCount = membersByGroup.get(group.id) ?? 0;
              const remainingSeats = group.capacity - memberCount;

              return (
                <div
                  key={group.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">{group.name}</div>
                    <div className="text-sm text-slate-600">
                      {memberCount} assigned · {remainingSeats} seat
                      {remainingSeats === 1 ? '' : 's'} left
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {memberCount}/{group.capacity}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
            href={`/sessions/${sessionId}/groups`}
          >
            <div className="text-sm font-medium text-slate-900">Group creation</div>
            <div className="text-sm text-slate-600">
              Manage groups, capacities, and membership changes.
            </div>
          </Link>
          <Link
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
            href={`/s/${session.slug}`}
          >
            <div className="text-sm font-medium text-slate-900">Public page</div>
            <div className="text-sm text-slate-600">See the student-facing enrolment view.</div>
          </Link>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          href={`/sessions/${sessionId}/students`}
        >
          <div className="text-sm font-medium text-slate-900">Students</div>
          <div className="text-sm text-slate-600">Import and review the student roster.</div>
        </Link>
        <Link
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          href={`/sessions/${sessionId}/groups`}
        >
          <div className="text-sm font-medium text-slate-900">Groups</div>
          <div className="text-sm text-slate-600">Create groups and manage memberships.</div>
        </Link>
        <Link
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          href={`/s/${session.slug}`}
        >
          <div className="text-sm font-medium text-slate-900">Public page</div>
          <div className="text-sm text-slate-600">Open the student self-selection flow.</div>
        </Link>
        <Link
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          href={`/sessions/${sessionId}/order`}
        >
          <div className="text-sm font-medium text-slate-900">Presentation order</div>
          <div className="text-sm text-slate-600">Set order and upload group files.</div>
        </Link>
        <Link
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          href="/sessions"
        >
          <div className="text-sm font-medium text-slate-900">Sessions list</div>
          <div className="text-sm text-slate-600">Return to the sessions overview.</div>
        </Link>
      </div>
    </main>
  );
}
