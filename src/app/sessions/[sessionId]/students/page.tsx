import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin-shell';
import { SessionStudentsWorkspace } from '@/components/session-students-workspace';
import { db, sessionStudents, sessions } from '@/db';
import { getSessionExportMetadataRecord } from '@/lib/exports/repository';
import { recordSessionAdminPath } from '@/lib/session-navigation';

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
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/groups`}>
            Groups
          </Link>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/evaluation`}>
            Evaluation
          </Link>
          <Link className="ui-button ui-button-primary" href="/sessions">
            Sessions list
          </Link>
        </>
        }
        currentStep={1}
      description="Manage Pairagogie session metadata and import students from Boostcamp."
      sessionId={sessionId}
      slug={session[0].slug}
      subtitle="Pairagogie & students setup"
      title={`${session[0].title} · Pairagogie & students setup`}
    >
      <SessionStudentsWorkspace
        autoOpenImport={shouldAutoOpenImport}
        existingEmails={studentRows.map((student) => student.schoolEmail)}
        metadata={metadata}
        language={session[0].language}
        sessionId={sessionId}
        students={studentRows}
      />
    </AdminShell>
  );
}
