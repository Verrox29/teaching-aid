import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';

import { movePresentationOrderAction } from './actions';

import { AdminShell } from '@/components/admin-shell';
import { GroupSubmissionDropzone } from '@/components/group-submission-dropzone';
import { RandomizeOrderButton } from '@/components/randomize-order-button';
import { db, groups, submissions, sessions } from '@/db';
import { cleanupExpiredSubmissions } from '@/lib/submission-retention';
import { getUiLanguageFromCookieValue, getUiText, UI_LANGUAGE_COOKIE_NAME } from '@/lib/ui-language';

type SessionOrderPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SessionOrderPage({
  params,
  searchParams
}: SessionOrderPageProps) {
  const { sessionId } = await params;
  const cookieStore = await cookies();
  const uiLanguage = getUiLanguageFromCookieValue(cookieStore.get(UI_LANGUAGE_COOKIE_NAME)?.value);
  const t = getUiText(uiLanguage).sessionOrder;
  const search = searchParams ? await searchParams : {};
  const notice = getSingleValue(search.notice);
  const error = getSingleValue(search.error);

  await cleanupExpiredSubmissions();

  const sessionRows = await db
    .select({
      id: sessions.id,
      slug: sessions.slug,
      title: sessions.title
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (sessionRows.length === 0) {
    notFound();
  }

  const session = sessionRows[0];
  const groupRows = await db
    .select({
      id: groups.id,
      name: groups.name,
      capacity: groups.capacity,
      presentationOrder: groups.presentationOrder,
      createdAt: groups.createdAt
    })
    .from(groups)
    .where(eq(groups.sessionId, sessionId))
    .orderBy(asc(groups.createdAt));

  const submissionRows = await db
    .select({
      groupId: submissions.groupId,
      fileName: submissions.title,
      submittedAt: submissions.submittedAt
    })
    .from(submissions)
    .where(eq(submissions.sessionId, sessionId));

  const submissionByGroupId = new Map(
    submissionRows.map((submission) => [submission.groupId, submission])
  );

  const orderedGroups = [...groupRows].sort((left, right) => {
    const leftOrder = left.presentationOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.presentationOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  const orderReady = orderedGroups.some((group) => group.presentationOrder !== null);

  return (
    <AdminShell
      actions={
        <>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/groups`}>
            {t.groups}
          </Link>
          <Link className="ui-button ui-button-secondary" href="/sessions">
            {t.sessionsList}
          </Link>
        </>
      }
      description={t.description}
      sessionId={sessionId}
      slug={session.slug}
      subtitle={t.subtitle}
      title={session.title}
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

      <section className="ui-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t.presentationOrderControls}</h2>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            {orderReady ? t.useButtonsToMove : t.generateOrder}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RandomizeOrderButton
            groups={orderedGroups.map((group) => ({
              groupId: group.id,
              groupName: group.name
            }))}
            sessionId={sessionId}
          />
        </div>
      </section>

      {orderedGroups.length === 0 ? (
        <section className="ui-panel p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{t.noGroupsYet}</h2>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              {t.createGroupsFirst}
            </p>
          </div>
          <div className="mt-4">
            <Link className="ui-button ui-button-primary" href={`/sessions/${sessionId}/groups`}>
              {t.goToGroups}
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-4">
          {orderedGroups.map((group, index) => {
            const submission = submissionByGroupId.get(group.id) ?? null;
            const isFirst = index === 0;
            const isLast = index === orderedGroups.length - 1;

            return (
              <article key={group.id} className="ui-card grid gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="ui-chip">{t.order} {index + 1}</span>
                      {group.presentationOrder === null ? (
                        <span className="ui-chip">{t.notLocked}</span>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-semibold">{group.name}</h3>
                    <p className="text-sm text-[color:var(--app-fg-muted)]">
                      {t.capacity} {group.capacity}.{' '}
                      {submission ? `${t.uploadedFile}: ${submission.fileName}` : t.noFileUploaded}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form action={movePresentationOrderAction}>
                      <input name="sessionId" type="hidden" value={sessionId} />
                      <input name="groupId" type="hidden" value={group.id} />
                      <input name="direction" type="hidden" value="up" />
                      <button
                        className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isFirst}
                        type="submit"
                      >
                        {t.moveUp}
                      </button>
                    </form>
                    <form action={movePresentationOrderAction}>
                      <input name="sessionId" type="hidden" value={sessionId} />
                      <input name="groupId" type="hidden" value={group.id} />
                      <input name="direction" type="hidden" value="down" />
                      <button
                        className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isLast}
                        type="submit"
                      >
                        {t.moveDown}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <GroupSubmissionDropzone
                    fileName={submission?.fileName ?? null}
                    groupId={group.id}
                    groupName={group.name}
                    sessionId={sessionId}
                    submittedAt={
                      submission?.submittedAt
                        ? submission.submittedAt.toLocaleString('en-GB', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })
                        : null
                    }
                  />
                </div>
              </article>
            );
          })}
        </section>
      )}
    </AdminShell>
  );
}
