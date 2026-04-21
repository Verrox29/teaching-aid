import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';

import { AdminShell } from '@/components/admin-shell';
import { PendingNavigationLink } from '@/components/pending-navigation-link';
import { SessionStudentsWorkspace } from '@/components/session-students-workspace';
import { db, sessionStudents, sessions } from '@/db';
import { getSessionExportMetadataRecord } from '@/lib/exports/repository';
import { recordSessionAdminPath } from '@/lib/session-navigation';
import { getUiLanguageFromCookieValue, getUiText, UI_LANGUAGE_COOKIE_NAME } from '@/lib/ui-language';

type SessionStudentsPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export default async function SessionStudentsPage({
  params,
  searchParams
}: SessionStudentsPageProps) {
  const { sessionId } = await params;
  const cookieStore = await cookies();
  const uiLanguage = getUiLanguageFromCookieValue(cookieStore.get(UI_LANGUAGE_COOKIE_NAME)?.value);
  const t = getUiText(uiLanguage).sessionStudents;
  const search = searchParams ? await searchParams : {};
  const session = await db
    .select({
      id: sessions.id,
      slug: sessions.slug,
      lastAdminPath: sessions.lastAdminPath,
      language: sessions.language,
      title: sessions.title
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (session.length === 0) {
    notFound();
  }

  await recordSessionAdminPath(sessionId, `/sessions/${sessionId}/students`);

  const metadata = await getSessionExportMetadataRecord(sessionId, session[0].title);
  const students = await db
    .select({
      id: sessionStudents.id,
      firstName: sessionStudents.firstName,
      lastName: sessionStudents.lastName,
      schoolEmail: sessionStudents.schoolEmail,
      createdAt: sessionStudents.createdAt
    })
    .from(sessionStudents)
    .where(eq(sessionStudents.sessionId, sessionId))
    .orderBy(
      asc(sessionStudents.lastName),
      asc(sessionStudents.firstName),
      asc(sessionStudents.schoolEmail)
    );
  const studentRows = students.map((student) => ({
    ...student,
    createdAtLabel: new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC'
    }).format(student.createdAt)
  }));
  const shouldAutoOpenImport =
    String(search.setup ?? '') === '1' || session[0].lastAdminPath === null;

  return (
    <AdminShell
      actions={
        <>
          <PendingNavigationLink className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/groups`}>
            {t.groupsLink}
          </PendingNavigationLink>
          <PendingNavigationLink className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/evaluation`}>
            {t.evaluationLink}
          </PendingNavigationLink>
          <PendingNavigationLink className="ui-button ui-button-primary" href="/sessions">
            {t.sessionsListLink}
          </PendingNavigationLink>
        </>
        }
        currentStep={1}
      description={t.pageSubtitle}
      sessionId={sessionId}
      slug={session[0].slug}
      subtitle={t.pageTitle}
      title={`${session[0].title} · ${t.pageTitle}`}
    >
      <SessionStudentsWorkspace
        autoOpenImport={shouldAutoOpenImport}
        existingEmails={studentRows.map((student) => student.schoolEmail)}
        metadata={metadata}
        language={session[0].language as 'en' | 'fr'}
        sessionId={sessionId}
        students={studentRows}
      />
    </AdminShell>
  );
}
