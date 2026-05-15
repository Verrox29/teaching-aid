import Link from 'next/link';
import { asc, desc, eq } from 'drizzle-orm';

import { AdminShell } from '@/components/admin-shell';
import { GlobalSettingsButton } from '@/components/global-settings-button';
import { SessionDeleteAction } from '@/components/session-delete-action';
import { SessionGroupLockToggleAction } from '@/components/session-group-lock-toggle-action';
import { SessionSubmissionsRetentionAction } from '@/components/session-submissions-retention-action';
import { SessionUploadStudentsWorkAction } from '@/components/session-upload-students-work-action';
import { db, groups, sessionExportMetadata, sessions, submissions } from '@/db';
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

type SessionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
  const cookieStore = await cookies();
  const uiLanguage = getUiLanguageFromCookieValue(cookieStore.get(UI_LANGUAGE_COOKIE_NAME)?.value);
  const uiText = getUiText(uiLanguage);
  const t = uiText.sessionsHub;
  const shared = uiText.shared;
  const sessionAdmin = uiText.sessionAdmin;
  const search = searchParams ? await searchParams : {};
  const notice = getSingleValue(search.notice);
  const error = getSingleValue(search.error);
  await cleanupExpiredSubmissions();

  const [sessionList, groupRows, submissionRows] = await Promise.all([
    db
      .select({
        className: sessionExportMetadata.className,
        sessionDate: sessionExportMetadata.sessionDate,
        id: sessions.id,
        title: sessions.title,
        language: sessions.language,
        groupSelectionLocked: sessions.groupSelectionLocked,
        createdAt: sessions.createdAt
      })
      .from(sessions)
      .leftJoin(sessionExportMetadata, eq(sessionExportMetadata.sessionId, sessions.id))
      .orderBy(desc(sessions.createdAt)),
    db
      .select({
        createdAt: groups.createdAt,
        id: groups.id,
        name: groups.name,
        sessionId: groups.sessionId
      })
      .from(groups)
      .orderBy(asc(groups.createdAt)),
    db
      .select({
        createdAt: submissions.createdAt,
        groupId: submissions.groupId,
        sessionId: submissions.sessionId,
        title: submissions.title,
        submittedAt: submissions.submittedAt
      })
      .from(submissions)
  ]);

  const submissionDeletionBySessionId = new Map<string, Date>();
  const groupBySessionId = new Map<string, { id: string; name: string }[]>();
  const submissionByGroupId = new Map<
    string,
    { createdAt: string; fileName: string | null; submittedAt: string | null }
  >();
  const submissionsBySessionId = new Map<string, { createdAt: Date; submittedAt: Date | null }[]>();

  for (const group of groupRows) {
    const current = groupBySessionId.get(group.sessionId) ?? [];
    current.push({
      id: group.id,
      name: group.name
    });
    groupBySessionId.set(group.sessionId, current);
  }

  for (const submission of submissionRows) {
    const current = submissionsBySessionId.get(submission.sessionId) ?? [];
    current.push(submission);
    submissionsBySessionId.set(submission.sessionId, current);
    submissionByGroupId.set(submission.groupId, {
      createdAt: submission.createdAt.toISOString(),
      fileName: submission.title,
      submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null
    });
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
      {notice || error ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? 'border-[color:var(--app-danger)]/20 bg-[color:var(--app-danger)]/10 text-[color:var(--app-danger)]'
              : 'border-[color:var(--app-success)]/20 bg-[color:var(--app-success)]/10 text-[color:var(--app-success)]'
          }`}
        >
          {notice ?? error}
        </div>
      ) : null}

      <section className="ui-card overflow-hidden">
        <table className="min-w-full divide-y divide-[color:var(--app-border)] text-sm">
          <thead className="text-left text-[color:var(--app-fg-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">{t.columns.title}</th>
              <th className="px-4 py-3 font-medium">{sessionAdmin.class}</th>
              <th className="px-4 py-3 font-medium">{shared.date}</th>
              <th className="px-4 py-3 font-medium">{t.columns.language}</th>
              <th className="px-4 py-3 font-medium">{t.columns.groupLock}</th>
              <th className="px-4 py-3 font-medium">{t.columns.studentWork}</th>
              <th className="px-4 py-3 font-medium">{t.columns.created}</th>
              <th className="px-4 py-3 font-medium">{t.columns.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--app-border)]">
            {sessionList.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[color:var(--app-fg-muted)]" colSpan={8}>
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
                    <SessionGroupLockToggleAction
                      groupSelectionLocked={session.groupSelectionLocked}
                      sessionId={session.id}
                      sessionTitle={session.title}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {submissionDeletionBySessionId.get(session.id) ? (
                      <SessionSubmissionsRetentionAction
                        latestExpiryAt={submissionDeletionBySessionId.get(session.id)!.toISOString()}
                        sessionId={session.id}
                        sessionTitle={session.title}
                        submissions={(groupBySessionId.get(session.id) ?? [])
                          .map((group) => {
                            const submission = submissionByGroupId.get(group.id);
                            if (!submission?.fileName) {
                              return null;
                            }

                            return {
                              createdAt: submission.createdAt,
                              fileName: submission.fileName,
                              groupId: group.id,
                              groupName: group.name,
                              submittedAt: submission.submittedAt
                            };
                          })
                          .filter((submission): submission is {
                            createdAt: string;
                            fileName: string;
                            groupId: string;
                            groupName: string;
                            submittedAt: string | null;
                          } => submission !== null)}
                      />
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
                    <div className="flex flex-col items-start gap-2">
                      <SessionUploadStudentsWorkAction
                        groups={(groupBySessionId.get(session.id) ?? []).map((group) => ({
                          fileName: submissionByGroupId.get(group.id)?.fileName ?? null,
                          groupId: group.id,
                          groupName: group.name,
                          submittedAt: submissionByGroupId.get(group.id)?.submittedAt ?? null
                        }))}
                        sessionId={session.id}
                        sessionTitle={session.title}
                      />
                      <SessionDeleteAction
                        sessionId={session.id}
                        sessionTitle={session.title}
                        triggerClassName="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--app-danger)] underline-offset-4 hover:underline"
                      />
                    </div>
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
