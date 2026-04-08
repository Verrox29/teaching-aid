import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

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
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">Session</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {session[0].title} · Students
          </h1>
        </div>
        <Link
          className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
          href="/sessions"
        >
          Back to sessions
        </Link>
      </div>

      <SessionStudentImport
        existingEmails={students.map((student) => student.schoolEmail)}
        sessionId={sessionId}
      />

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">Imported students</h2>
          <p className="text-sm text-slate-600">
            Students already saved in this session roster.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">First name</th>
                <th className="px-4 py-3 font-medium">Last name</th>
                <th className="px-4 py-3 font-medium">School email</th>
                <th className="px-4 py-3 font-medium">Imported at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {students.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={4}>
                    No students imported yet.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id}>
                    <td className="px-4 py-3 text-slate-900">{student.firstName}</td>
                    <td className="px-4 py-3 text-slate-900">{student.lastName}</td>
                    <td className="px-4 py-3 text-slate-700">{student.schoolEmail}</td>
                    <td className="px-4 py-3 text-slate-500">
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
    </main>
  );
}
