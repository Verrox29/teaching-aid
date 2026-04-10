import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { saveExportMetadataAction } from '@/app/sessions/[sessionId]/exports/actions';
import { AdminShell } from '@/components/admin-shell';
import { SessionStudentImport } from '@/components/session-student-import';
import { db, sessionStudents, sessions } from '@/db';
import { getSessionExportMetadataRecord } from '@/lib/exports/repository';
import { recordSessionAdminPath } from '@/lib/session-navigation';

type SessionStudentsPageProps = {
  params: Promise<{ sessionId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function SessionStudentsPage({
  params
}: SessionStudentsPageProps) {
  const { sessionId } = await params;
  const session = await db
    .select({
      id: sessions.id,
      slug: sessions.slug,
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

  return (
    <AdminShell
      actions={
        <>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/groups`}>
            Groups
          </Link>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/order`}>
            Order
          </Link>
          <Link className="ui-button ui-button-primary" href="/sessions">
            Sessions list
          </Link>
        </>
      }
      currentStep={1}
      description="Set the Pairagogie session metadata and import the student roster."
      sessionId={sessionId}
      slug={session[0].slug}
      subtitle="Pairagogie setup"
      title={`${session[0].title} · Pairagogie setup`}
    >
      <section className="ui-panel grid gap-5 p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Pairagogie session metadata</h2>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            Save the session details used by exports, then import the student roster below.
          </p>
        </div>

        <form action={saveExportMetadataAction} className="grid gap-4">
          <input name="sessionId" type="hidden" value={sessionId} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['programme', 'Programme', metadata.programme, 'text'],
              ['className', 'Class name', metadata.className, 'text'],
              ['subject', 'Subject', metadata.subject, 'text'],
              ['professorName', 'Professor name', metadata.professorName, 'text'],
              ['sessionDate', 'Presentation date', metadata.sessionDate, 'text']
            ].map(([name, label, value, type]) => (
              <label key={name} className="grid gap-2 text-sm font-medium">
                {label}
                <input className="ui-input" defaultValue={value} name={name} type={type} />
              </label>
            ))}

            <label className="grid gap-2 text-sm font-medium">
              Season
              <select className="ui-select" defaultValue={metadata.season} name="season" required>
                <option disabled value="">
                  Choose season
                </option>
                <option value="Fall">Fall</option>
                <option value="Spring">Spring</option>
              </select>
            </label>
          </div>

          <div className="flex justify-end">
            <button className="ui-button ui-button-primary" type="submit">
              Save Pairagogie setup
            </button>
          </div>
        </form>
      </section>

      <SessionStudentImport
        existingEmails={students.map((student) => student.schoolEmail)}
        sessionId={sessionId}
      />

      <section className="ui-panel grid gap-4 p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Imported students</h2>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            Students already saved in this session roster.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
          <table className="min-w-full divide-y divide-[color:var(--app-border)] text-sm">
            <thead className="text-left text-[color:var(--app-fg-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">First name</th>
                <th className="px-4 py-3 font-medium">Last name</th>
                <th className="px-4 py-3 font-medium">School email</th>
                <th className="px-4 py-3 font-medium">Imported at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--app-border)] bg-[color:var(--app-surface)]">
              {students.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[color:var(--app-fg-muted)]" colSpan={4}>
                    No students imported yet.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id}>
                    <td className="px-4 py-3">{student.firstName}</td>
                    <td className="px-4 py-3">{student.lastName}</td>
                    <td className="px-4 py-3 text-[color:var(--app-fg-muted)]">{student.schoolEmail}</td>
                    <td className="px-4 py-3 text-[color:var(--app-fg-muted)]">
                      {student.createdAt.toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
