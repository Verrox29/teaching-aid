import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { createDefaultGroupsAction } from './actions';

import { AdminShell } from '@/components/admin-shell';
import { AppPendingFormBridge } from '@/components/app-interaction-feedback';
import { SessionGroupsBoard } from '@/components/session-groups-board';
import { db, sessions } from '@/db';
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
            {t.resume}
          </Link>
          <Link className="ui-button ui-button-secondary" href={`/s/${session.slug}`}>
            {t.publicPage}
          </Link>
          <Link className="ui-button ui-button-primary" href="/sessions">
            {t.sessionsList}
          </Link>
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
              {t.noGroupsYet} {t.createGroupsHelp.replace('{count}', String(session.groupCount))}
            </p>
          </div>

          <form action={createDefaultGroupsAction} className="mt-4">
            <AppPendingFormBridge />
            <input name="sessionId" type="hidden" value={sessionId} />
            <button
              className="ui-button ui-button-primary"
              type="submit"
            >
              {t.createDefaultGroupsButton}
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
        publicPageHref={`/s/${session.slug}`}
        groupSelectionLocked={session.groupSelectionLocked}
        unassignedStudents={boardSnapshot.unassignedStudents}
      />
    </AdminShell>
  );
}
