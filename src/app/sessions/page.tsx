import Link from 'next/link';
import { desc } from 'drizzle-orm';

import { AdminShell } from '@/components/admin-shell';
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
    <AdminShell
      actions={
        <Link className="ui-button ui-button-primary" href="/sessions/new">
          New session
        </Link>
      }
      description="Create and manage peer-to-peer sessions."
      title="Sessions"
      subtitle="Teacher admin"
    >
      <section className="ui-card overflow-hidden">
        <table className="min-w-full divide-y divide-[color:var(--app-border)] text-sm">
          <thead className="text-left text-[color:var(--app-fg-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Language</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Group lock</th>
              <th className="px-4 py-3 font-medium">Order lock</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--app-border)]">
            {sessionList.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[color:var(--app-fg-muted)]" colSpan={7}>
                  No sessions yet. Create the first one to get started.
                </td>
              </tr>
            ) : (
              sessionList.map((session) => (
                <tr key={session.id} className="text-[color:var(--app-fg)]">
                  <td className="px-4 py-3 font-medium">{session.title}</td>
                  <td className="px-4 py-3">{session.language}</td>
                  <td className="px-4 py-3">
                    <code className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-xs text-[color:var(--app-fg-muted)]">
                      {session.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`ui-chip ${session.groupSelectionLocked ? 'ui-chip-warning' : 'ui-chip-success'}`}
                    >
                      {session.groupSelectionLocked ? 'Locked' : 'Open'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`ui-chip ${session.presentationOrderLocked ? 'ui-chip-warning' : 'ui-chip-success'}`}
                    >
                      {session.presentationOrderLocked ? 'Locked' : 'Open'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {session.createdAt.toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="text-sm font-medium text-[color:var(--app-accent-strong)] underline-offset-4 hover:underline"
                      href={`/sessions/${session.id}`}
                    >
                      Hub
                    </Link>
                    <span className="px-2 text-[color:var(--app-fg-muted)] opacity-50">·</span>
                    <Link
                      className="text-sm font-medium text-[color:var(--app-accent-strong)] underline-offset-4 hover:underline"
                      href={`/s/${session.slug}`}
                    >
                      Public
                    </Link>
                    <span className="px-2 text-[color:var(--app-fg-muted)] opacity-50">·</span>
                    <Link
                      className="text-sm font-medium text-[color:var(--app-accent-strong)] underline-offset-4 hover:underline"
                      href={`/sessions/${session.id}/students`}
                    >
                      Students
                    </Link>
                    <span className="px-2 text-[color:var(--app-fg-muted)] opacity-50">·</span>
                    <Link
                      className="text-sm font-medium text-[color:var(--app-accent-strong)] underline-offset-4 hover:underline"
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
      </section>
    </AdminShell>
  );
}
