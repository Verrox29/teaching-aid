import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';

import { createDefaultGroupsAction } from './actions';

import { AdminShell } from '@/components/admin-shell';
import { AppPendingFormBridge } from '@/components/app-interaction-feedback';
import { SessionGroupsBoard } from '@/components/session-groups-board';
import { PendingNavigationLink } from '@/components/pending-navigation-link';
import { db, sessions, submissions } from '@/db';
import { cleanupExpiredSubmissions } from '@/lib/submission-retention';
import { recordSessionAdminPath } from '@/lib/session-navigation';
import { getSessionGroupBoardSnapshot } from '@/lib/session-group-board';
import { getUiLanguageFromCookieValue, getUiText, UI_LANGUAGE_COOKIE_NAME } from '@/lib/ui-language';

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
  const cookieStore = await cookies();
  const uiLanguage = getUiLanguageFromCookieValue(cookieStore.get(UI_LANGUAGE_COOKIE_NAME)?.value);
  const t = getUiText(uiLanguage).sessionGroups;
  const search = searchParams ? await searchParams : {};
  const notice = getSingleValue(search.notice);
  const error = getSingleValue(search.error);
  const errorStudentId = getSingleValue(search.errorStudentId);
  const errorGroupId = getSingleValue(search.errorGroupId);

  await cleanupExpiredSubmissions();

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
  const [boardSnapshot, submissionRows] = await Promise.all([
    getSessionGroupBoardSnapshot(sessionId),
    db
      .select({
        fileName: submissions.title,
        groupId: submissions.groupId,
        submittedAt: submissions.submittedAt
      })
      .from(submissions)
      .where(eq(submissions.sessionId, sessionId))
  ]);
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
          <PendingNavigationLink className="ui-button ui-button-secondary" href={`/sessions/${sessionId}`}>
            {t.resume}
          </PendingNavigationLink>
          <PendingNavigationLink className="ui-button ui-button-secondary" href={`/s/${session.slug}`}>
            {t.publicPage}
          </PendingNavigationLink>
          <PendingNavigationLink className="ui-button ui-button-primary" href="/sessions">
            {t.sessionsList}
          </PendingNavigationLink>
        </>
      }
      currentStep={2}
      description={t.description}
      sessionId={sessionId}
      slug={session.slug}
      subtitle={t.subtitle}
      title={session.title}
    >
      {boardSnapshot.groups.length === 0 ? (
        <section className="ui-panel p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{t.createDefaultGroups}</h2>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              {t.noGroupsYet} {t.createGroupsHelp}
            </p>
          </div>

          <form action={createDefaultGroupsAction} className="mt-4 grid gap-4">
            <AppPendingFormBridge />
            <input name="sessionId" type="hidden" value={sessionId} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                {t.groupCount}
                <input className="ui-input" defaultValue={session.groupCount} min="1" name="groupCount" type="number" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                {t.defaultGroupCapacity}
                <input
                  className="ui-input"
                  defaultValue={session.defaultGroupCapacity}
                  min="1"
                  name="defaultGroupCapacity"
                  type="number"
                />
              </label>
            </div>
            <div className="flex justify-end">
              <button className="ui-button ui-button-primary" type="submit">
                {t.createDefaultGroupsButton}
              </button>
            </div>
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
        studentWorkSubmissions={submissionRows.map((submission) => ({
          fileName: submission.fileName,
          groupId: submission.groupId,
          submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null
        }))}
        publicPageHref={`/s/${session.slug}`}
        groupSelectionLocked={session.groupSelectionLocked}
        unassignedStudents={boardSnapshot.unassignedStudents}
      />
    </AdminShell>
  );
}
