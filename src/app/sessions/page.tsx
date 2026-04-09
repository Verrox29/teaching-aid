import Link from 'next/link';
import { desc } from 'drizzle-orm';

import { db, sessions } from '@/db';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  const sessionList = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      language: sessions.language,
      slug: sessions.slug,
      groupSelectionLocked: sessions.groupSelectionLocked,
      presentationOrderLocked: sessions.presentationOrderLocked,
      createdAt: sessions.createdAt
    })
    .from(sessions)
    .orderBy(desc(sessions.createdAt));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Sessions</h1>
          <p className="text-sm text-slate-600">
            Create and manage peer-to-peer sessions.
          </p>
        </div>

        <Link
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          href="/sessions/new"
        >
          New session
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Language</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Group Selection Locked</th>
              <th className="px-4 py-3 font-medium">Presentation Order Locked</th>
              <th className="px-4 py-3 font-medium">Created At</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sessionList.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={7}>
                  No sessions yet. Create the first one to get started.
                </td>
              </tr>
            ) : (
              sessionList.map((session) => (
                <tr key={session.id} className="text-slate-700">
                  <td className="px-4 py-3 font-medium text-slate-900">{session.title}</td>
                  <td className="px-4 py-3">{session.language}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {session.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    {session.groupSelectionLocked ? 'Yes' : 'No'}
                  </td>
                  <td className="px-4 py-3">
                    {session.presentationOrderLocked ? 'Yes' : 'No'}
                  </td>
                  <td className="px-4 py-3">
                    {session.createdAt.toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
                      href={`/s/${session.slug}`}
                    >
                      Public
                    </Link>
                    <span className="px-2 text-slate-300">·</span>
                    <Link
                      className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
                      href={`/sessions/${session.id}/students`}
                    >
                      Students
                    </Link>
                    <span className="px-2 text-slate-300">·</span>
                    <Link
                      className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
                      href={`/sessions/${session.id}/groups`}
                    >
                      Groups
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
