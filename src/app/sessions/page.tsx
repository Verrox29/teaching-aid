import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';

import { AdminShell } from '@/components/admin-shell';
import { GlobalSettingsButton } from '@/components/global-settings-button';
import { SessionDeleteAction } from '@/components/session-delete-action';
import { db, sessionExportMetadata, sessions, submissions } from '@/db';
import { cookies } from 'next/headers';
import {
  cleanupExpiredSubmissions,
  getLatestSubmissionDeletionDate
} from '@/lib/submission-retention';
import {
  formatUiDateTime,
  getUiLanguageFromCookieValue,
  getUiText,
  UI_LANGUAGE_COOKIE_NAME
} from '@/lib/ui-language';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  const cookieStore = await cookies();
  const uiLanguage = getUiLanguageFromCookieValue(cookieStore.get(UI_LANGUAGE_COOKIE_NAME)?.value);
  const uiText = getUiText(uiLanguage);
  const t = uiText.sessionsHub;
  const shared = uiText.shared;
  const sessionAdmin = uiText.sessionAdmin;
  await cleanupExpiredSubmissions();

  const [sessionList, submissionRows] = await Promise.all([
    db
      .select({
        className: sessionExportMetadata.className,
        sessionDate: sessionExportMetadata.sessionDate,
        id: sessions.id,
        title: sessions.title,
        language: sessions.language,
        groupSelectionLocked: sessions.groupSelectionLocked,
        presentationOrderLocked: sessions.presentationOrderLocked,
        createdAt: sessions.createdAt
      })
      .from(sessions)
      .leftJoin(sessionExportMetadata, eq(sessionExportMetadata.sessionId, sessions.id))
      .orderBy(desc(sessions.createdAt)),
    db
      .select({
        createdAt: submissions.createdAt,
        sessionId: submissions.sessionId,
        submittedAt: submissions.submittedAt
      })
      .from(submissions)
  ]);

  const submissionDeletionBySessionId = new Map<string, Date>();
  const submissionsBySessionId = new Map<string, { createdAt: Date; submittedAt: Date | null }[]>();
  for (const submission of submissionRows) {
    const current = submissionsBySessionId.get(submission.sessionId) ?? [];
    current.push(submission);
    submissionsBySessionId.set(submission.sessionId, current);
  }

  for (const [sessionId, sessionSubmissions] of submissionsBySessionId.entries()) {
    const deletionDate = getLatestSubmissionDeletionDate(sessionSubmissions);
    if (deletionDate) {
      submissionDeletionBySessionId.set(sessionId, deletionDate);
    }
  }

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
              <th className="px-4 py-3 font-medium">{sessionAdmin.class}</th>
              <th className="px-4 py-3 font-medium">{shared.date}</th>
              <th className="px-4 py-3 font-medium">{t.columns.language}</th>
              <th className="px-4 py-3 font-medium">{t.columns.groupLock}</th>
              <th className="px-4 py-3 font-medium">{t.columns.orderLock}</th>
              <th className="px-4 py-3 font-medium">{t.columns.studentWork}</th>
              <th className="px-4 py-3 font-medium">{t.columns.created}</th>
              <th className="px-4 py-3 font-medium">{t.columns.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--app-border)]">
            {sessionList.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[color:var(--app-fg-muted)]" colSpan={9}>
                  {t.empty}
                </td>
              </tr>
            ) : (
              sessionList.map((session) => (
                <tr key={session.id} className="text-[color:var(--app-fg)]">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      className="font-medium text-[color:var(--app-accent-strong)] underline-offset-4 hover:underline"
                      href={`/sessions/${session.id}`}
                    >
                      {session.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {session.className?.trim() || shared.notSet}
                  </td>
                  <td className="px-4 py-3">
                    {session.sessionDate?.trim() || shared.notSet}
                  </td>
                  <td className="px-4 py-3">{session.language}</td>
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
                    {submissionDeletionBySessionId.get(session.id) ? (
                      <span className="ui-chip ui-chip-warning whitespace-normal text-left leading-5">
                        {t.deletesOn.replace(
                          '{date}',
                          formatUiDateTime(submissionDeletionBySessionId.get(session.id)!, uiLanguage)
                        )}
                      </span>
                    ) : (
                      <span className="text-[color:var(--app-fg-muted)]">{t.noWorkUploaded}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {session.createdAt.toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <SessionDeleteAction
                      sessionId={session.id}
                      sessionTitle={session.title}
                      triggerClassName="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--app-danger)] underline-offset-4 hover:underline"
                    />
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
