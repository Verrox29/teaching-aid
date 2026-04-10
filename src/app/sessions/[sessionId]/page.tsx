import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin-shell';
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
    <AdminShell
      actions={
        <>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/students`}>
            Students
          </Link>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/groups`}>
            Groups
          </Link>
          <Link className="ui-button ui-button-primary" href={`/sessions/${sessionId}/order`}>
            Order
          </Link>
        </>
      }
      currentStep={3}
      description="Use this hub to monitor enrolment, group coverage, and public access."
      sessionId={sessionId}
      slug={session.slug}
      subtitle="Group enrolment"
      title={session.title}
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="ui-card p-4">
          <p className="ui-section-title">Students</p>
          <p className="mt-2 text-3xl font-semibold">{totalStudents}</p>
        </div>
        <div className="ui-card p-4">
          <p className="ui-section-title">Assigned</p>
          <p className="mt-2 text-3xl font-semibold">{assignedCount}</p>
        </div>
        <div className="ui-card p-4">
          <p className="ui-section-title">Unassigned</p>
          <p className="mt-2 text-3xl font-semibold">{unassignedCount}</p>
        </div>
      </section>

      <section className="ui-panel p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Enrolment status</h2>
          <p className="ui-page-copy">
            Use the group creation page to edit groups and capacities, then monitor the final
            enrolment state here.
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {groupRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[color:var(--app-border)] px-4 py-3 text-sm text-[color:var(--app-fg-muted)]">
              No groups have been created yet.
            </div>
          ) : (
            groupRows.map((group) => {
              const memberCount = membersByGroup.get(group.id) ?? 0;
              const remainingSeats = group.capacity - memberCount;

              return (
                <div
                  key={group.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold">{group.name}</div>
                    <div className="text-sm text-[color:var(--app-fg-muted)]">
                      {memberCount} assigned · {remainingSeats} seat
                      {remainingSeats === 1 ? '' : 's'} left
                    </div>
                  </div>
                  <span className="ui-chip">
                    {memberCount}/{group.capacity}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            className="ui-card ui-card-soft p-4 transition hover:border-[color:var(--app-accent)] hover:bg-[color:var(--app-surface-soft)]"
            href={`/sessions/${sessionId}/groups`}
          >
            <div className="text-sm font-semibold">Group creation</div>
            <div className="text-sm text-[color:var(--app-fg-muted)]">
              Manage groups, capacities, and membership changes.
            </div>
          </Link>
          <Link
            className="ui-card ui-card-soft p-4 transition hover:border-[color:var(--app-accent)] hover:bg-[color:var(--app-surface-soft)]"
            href={`/s/${session.slug}`}
          >
            <div className="text-sm font-semibold">Public page</div>
            <div className="text-sm text-[color:var(--app-fg-muted)]">See the student-facing enrolment view.</div>
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Link className="ui-card p-4 transition hover:border-[color:var(--app-accent)]" href={`/sessions/${sessionId}/students`}>
            <div className="text-sm font-semibold">Students</div>
            <div className="text-sm text-[color:var(--app-fg-muted)]">Import and review the student roster.</div>
          </Link>
          <Link className="ui-card p-4 transition hover:border-[color:var(--app-accent)]" href={`/sessions/${sessionId}/groups`}>
            <div className="text-sm font-semibold">Groups</div>
            <div className="text-sm text-[color:var(--app-fg-muted)]">Create groups and manage memberships.</div>
          </Link>
          <Link className="ui-card p-4 transition hover:border-[color:var(--app-accent)]" href={`/sessions/${sessionId}/order`}>
            <div className="text-sm font-semibold">Presentation order</div>
            <div className="text-sm text-[color:var(--app-fg-muted)]">Set order and upload group files.</div>
          </Link>
          <Link className="ui-card p-4 transition hover:border-[color:var(--app-accent)]" href="/sessions">
            <div className="text-sm font-semibold">Sessions list</div>
            <div className="text-sm text-[color:var(--app-fg-muted)]">Return to the sessions overview.</div>
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}
