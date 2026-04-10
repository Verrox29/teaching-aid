import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  lockPresentationOrderAction,
  movePresentationOrderAction,
  randomizePresentationOrderAction,
  unlockPresentationOrderAction,
  uploadGroupSubmissionAction
} from './actions';

import { AdminTimelineNav } from '@/components/admin-timeline-nav';
import { db, groups, submissions, sessions } from '@/db';

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
  const search = searchParams ? await searchParams : {};
  const notice = getSingleValue(search.notice);
  const error = getSingleValue(search.error);

  const sessionRows = await db
    .select({
      id: sessions.id,
      slug: sessions.slug,
      title: sessions.title,
      presentationOrderLocked: sessions.presentationOrderLocked
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
  const currentStepLocked = session.presentationOrderLocked;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-8">
      <AdminTimelineNav
        currentStep={4}
        sessionId={sessionId}
        slug={session.slug}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Presentation order & upload</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {session.title}
          </h1>
          <div className="flex flex-wrap gap-2 text-sm text-slate-600">
            <span
              className={`rounded-full px-3 py-1 ${
                currentStepLocked ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {currentStepLocked ? 'Presentation order locked' : 'Presentation order open'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Groups: {orderedGroups.length}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Files uploaded: {submissionRows.length}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
            href={`/sessions/${sessionId}`}
          >
            Session hub
          </Link>
          <Link
            className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
            href="/sessions"
          >
            Back to sessions
          </Link>
        </div>
      </div>

      {notice || error ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {notice ?? error}
        </div>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Presentation order controls</h2>
          <p className="text-sm text-slate-600">
            {currentStepLocked
              ? 'The presentation order is locked. Unlock it to change the order.'
              : orderReady
                ? 'Use the buttons to move groups, randomize the order, or lock it once final.'
                : 'Generate a random order or move groups manually to set the sequence.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentStepLocked ? (
            <form action={unlockPresentationOrderAction}>
              <input name="sessionId" type="hidden" value={sessionId} />
              <button
                className="inline-flex items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                type="submit"
              >
                Unlock order
              </button>
            </form>
          ) : (
            <>
              <form action={randomizePresentationOrderAction}>
                <input name="sessionId" type="hidden" value={sessionId} />
                <button
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  type="submit"
                >
                  Randomize order
                </button>
              </form>
              <form action={lockPresentationOrderAction}>
                <input name="sessionId" type="hidden" value={sessionId} />
                <button
                  className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
                  type="submit"
                >
                  Lock order
                </button>
              </form>
            </>
          )}
        </div>
      </section>

      {orderedGroups.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900">No groups yet</h2>
            <p className="text-sm text-slate-600">
              Create groups first, then come back here to assign presentation order and upload
              files.
            </p>
          </div>
          <div className="mt-4">
            <Link
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              href={`/sessions/${sessionId}/groups`}
            >
              Go to groups
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
              <article
                key={group.id}
                className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        Order {index + 1}
                      </span>
                      {group.presentationOrder === null ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                          Not locked in yet
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{group.name}</h3>
                    <p className="text-sm text-slate-600">
                      Capacity {group.capacity}.{' '}
                      {submission ? `Uploaded file: ${submission.fileName}` : 'No file uploaded yet.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form action={movePresentationOrderAction}>
                      <input name="sessionId" type="hidden" value={sessionId} />
                      <input name="groupId" type="hidden" value={group.id} />
                      <input name="direction" type="hidden" value="up" />
                      <button
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        disabled={currentStepLocked || isFirst}
                        type="submit"
                      >
                        Move up
                      </button>
                    </form>
                    <form action={movePresentationOrderAction}>
                      <input name="sessionId" type="hidden" value={sessionId} />
                      <input name="groupId" type="hidden" value={group.id} />
                      <input name="direction" type="hidden" value="down" />
                      <button
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        disabled={currentStepLocked || isLast}
                        type="submit"
                      >
                        Move down
                      </button>
                    </form>
                  </div>
                </div>

                <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="text-sm text-slate-600">
                    <p className="font-medium text-slate-900">Upload group work</p>
                    <p>
                      Attach one file for this group. The file name is stored with the submission.
                    </p>
                    {submission?.submittedAt ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Uploaded on{' '}
                        {submission.submittedAt.toLocaleString('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </p>
                    ) : null}
                  </div>

                  <form
                    action={uploadGroupSubmissionAction}
                    className="flex flex-wrap items-center gap-2 sm:justify-end"
                    encType="multipart/form-data"
                  >
                    <input name="sessionId" type="hidden" value={sessionId} />
                    <input name="groupId" type="hidden" value={group.id} />
                    <input
                      className="max-w-[16rem] text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
                      name="file"
                      type="file"
                    />
                    <button
                      className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                      type="submit"
                    >
                      Upload file
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
