import Link from 'next/link';
import { desc } from 'drizzle-orm';

import { AdminShell } from '@/components/admin-shell';
import { GlobalSettingsButton } from '@/components/global-settings-button';
import { db, sessions } from '@/db';
import { cookies } from 'next/headers';
import { getUiLanguageFromCookieValue, getUiText, UI_LANGUAGE_COOKIE_NAME } from '@/lib/ui-language';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  const cookieStore = await cookies();
  const uiLanguage = getUiLanguageFromCookieValue(cookieStore.get(UI_LANGUAGE_COOKIE_NAME)?.value);
  const t = getUiText(uiLanguage).sessionsHub;
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
        <>
          <GlobalSettingsButton />
          <Link className="ui-button ui-button-primary" href="/sessions/new">
            {t.newSession}
          </Link>
        </>
      }
      description={t.description}
      title={t.title}
      subtitle={t.subtitle}
    >
      <section className="ui-card overflow-hidden">
        <table className="min-w-full divide-y divide-[color:var(--app-border)] text-sm">
          <thead className="text-left text-[color:var(--app-fg-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">{t.columns.title}</th>
              <th className="px-4 py-3 font-medium">{t.columns.language}</th>
              <th className="px-4 py-3 font-medium">{t.columns.slug}</th>
              <th className="px-4 py-3 font-medium">{t.columns.groupLock}</th>
              <th className="px-4 py-3 font-medium">{t.columns.orderLock}</th>
              <th className="px-4 py-3 font-medium">{t.columns.created}</th>
              <th className="px-4 py-3 font-medium">{t.columns.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--app-border)]">
            {sessionList.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[color:var(--app-fg-muted)]" colSpan={7}>
                  {t.empty}
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
                      {session.groupSelectionLocked ? t.locked : t.open}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`ui-chip ${session.presentationOrderLocked ? 'ui-chip-warning' : 'ui-chip-success'}`}
                    >
                      {session.presentationOrderLocked ? t.locked : t.open}
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
                      {t.resume}
                    </Link>
                    <span className="px-2 text-[color:var(--app-fg-muted)] opacity-50">·</span>
                    <Link
                      className="text-sm font-medium text-[color:var(--app-accent-strong)] underline-offset-4 hover:underline"
                      href={`/s/${session.slug}`}
                    >
                      {t.public}
                    </Link>
                    <span className="px-2 text-[color:var(--app-fg-muted)] opacity-50">·</span>
                    <Link
                      className="text-sm font-medium text-[color:var(--app-accent-strong)] underline-offset-4 hover:underline"
                      href={`/sessions/${session.id}/students`}
                    >
                      {t.setup}
                    </Link>
                    <span className="px-2 text-[color:var(--app-fg-muted)] opacity-50">·</span>
                    <Link
                      className="text-sm font-medium text-[color:var(--app-accent-strong)] underline-offset-4 hover:underline"
                      href={`/sessions/${session.id}/groups`}
                    >
                      {t.groups}
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
