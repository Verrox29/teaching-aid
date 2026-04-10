import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin-shell';
import { SessionStudentImport } from '@/components/session-student-import';
import { db, sessionStudents, sessions } from '@/db';

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
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}`}>
            Session hub
          </Link>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/groups`}>
            Groups
          </Link>
          <Link className="ui-button ui-button-primary" href="/sessions">
            Sessions list
          </Link>
        </>
      }
      currentStep={1}
      description="Upload or paste the student roster, then review imported rows."
      sessionId={sessionId}
      slug={session[0].slug}
      subtitle="Student import"
      title={`${session[0].title} · Students`}
    >
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
