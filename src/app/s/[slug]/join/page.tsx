import Link from 'next/link';
import { notFound } from 'next/navigation';

import { joinGroupAction } from '../actions';
import {
  getPublicGroupsForSession,
  getSessionBySlug,
  getSessionStudentsForSession,
  getStudentById,
  getStudentMembership
} from '../queries';
import { PublicStudentSearch } from '@/components/public-student-search';

type PublicJoinPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PublicJoinPage({ params, searchParams }: PublicJoinPageProps) {
  const { slug } = await params;
  const search = searchParams ? await searchParams : {};
  const notice = getSingleValue(search.notice);
  const error = getSingleValue(search.error);
  const studentId = getSingleValue(search.studentId);

  const session = await getSessionBySlug(slug);
  if (!session) {
    notFound();
  }

  const groups = await getPublicGroupsForSession(session.id);
  const students = await getSessionStudentsForSession(session.id);
  const identifiedStudent = studentId ? await getStudentById(session.id, studentId) : null;
  const currentMembership = studentId ? await getStudentMembership(session.id, studentId) : null;
  const isLocked = session.groupSelectionLocked;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <header className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Student join flow
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {session.title}
          </h1>
          <p className="text-sm text-slate-600">
            Identify yourself with a name or school email, then choose a group.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
            href={`/s/${slug}`}
          >
            Back to session
          </Link>
          {session.groupSelectionLocked ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
              Groups are locked
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              Groups are open
            </span>
          )}
        </div>
      </header>

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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {identifiedStudent ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Identified student
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {identifiedStudent.firstName} {identifiedStudent.lastName}
              </p>
              <p className="text-sm text-slate-600">{identifiedStudent.schoolEmail}</p>
              <p className="mt-2 text-sm text-slate-600">
                Current group:{' '}
                <span className="font-medium text-slate-900">
                  {currentMembership?.groupName ?? 'Not assigned yet'}
                </span>
              </p>
            </div>

            {isLocked ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Groups are locked for this session. You can view the current state, but you cannot
                join or switch groups.
              </div>
            ) : null}

            {!isLocked ? (
              <p className="text-sm text-slate-600">
                Choose a group below.{' '}
                {currentMembership
                  ? 'You can switch at any time before locking.'
                  : 'You can join one available group.'}
              </p>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              {groups.map((group) => {
                const remainingSeats = group.capacity - group.members.length;
                const isCurrentGroup = currentMembership?.groupId === group.id;
                const isFull = remainingSeats <= 0 && !isCurrentGroup;

                return (
                  <article
                    key={group.id}
                    className={`grid gap-3 rounded-xl border p-4 shadow-sm ${
                      isCurrentGroup
                        ? 'border-emerald-300 bg-emerald-50/60'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{group.name}</h2>
                        <p className="text-sm text-slate-600">
                          {remainingSeats} seat{remainingSeats === 1 ? '' : 's'} left
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {group.members.length}/{group.capacity}
                      </span>
                    </div>

                    <ul className="grid gap-2">
                      {group.members.length === 0 ? (
                        <li className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
                          No members yet.
                        </li>
                      ) : (
                        group.members.map((member) => (
                          <li
                            key={member.id}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                          >
                            {member.firstName} {member.lastName}
                          </li>
                        ))
                      )}
                    </ul>

                    {isLocked ? null : (
                      <form action={joinGroupAction} className="flex flex-wrap items-center gap-2">
                        <input name="slug" type="hidden" value={slug} />
                        <input name="studentId" type="hidden" value={identifiedStudent.id} />
                        <input name="groupId" type="hidden" value={group.id} />
                        <button
                          className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition ${
                            isCurrentGroup
                              ? 'border border-slate-300 bg-slate-100 text-slate-500'
                              : isFull
                                ? 'cursor-not-allowed border border-slate-300 bg-slate-100 text-slate-400'
                                : 'border border-slate-900 bg-slate-900 text-white hover:bg-slate-700'
                          }`}
                          type="submit"
                          disabled={isCurrentGroup || isFull}
                        >
                          {isCurrentGroup
                            ? 'Current group'
                            : currentMembership
                              ? 'Switch to this group'
                              : 'Join this group'}
                        </button>
                        {isFull ? (
                          <span className="text-sm text-rose-600">This group is full.</span>
                        ) : null}
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {isLocked ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Groups are locked for this session. You can view the session state, but you cannot
                join or switch groups.
              </div>
            ) : null}

            {isLocked ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                The groups are currently locked. You can review the roster below, but joining and
                switching are disabled until the teacher unlocks selection.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Search by name or school email to identify yourself. We only match students
                  already imported for this session.
                </div>

                <PublicStudentSearch sessionSlug={slug} students={students} />
              </>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Groups</h2>
          <p className="text-sm text-slate-600">
            {groups.reduce((count, group) => count + Math.max(0, group.capacity - group.members.length), 0)} seats remaining
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => {
            const remainingSeats = group.capacity - group.members.length;

            return (
              <article
                key={group.id}
                className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{group.name}</h3>
                    <p className="text-sm text-slate-600">
                      {remainingSeats} seat{remainingSeats === 1 ? '' : 's'} left
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {group.members.length}/{group.capacity}
                  </span>
                </div>

                <ul className="grid gap-2">
                  {group.members.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
                      No members yet.
                    </li>
                  ) : (
                    group.members.map((member) => (
                      <li
                        key={member.id}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                      >
                        {member.firstName} {member.lastName}
                      </li>
                    ))
                  )}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
