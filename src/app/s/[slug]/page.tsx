import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getPublicGroupsForSession, getSessionBySlug } from './queries';

type PublicSessionPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = 'force-dynamic';

export default async function PublicSessionPage({ params }: PublicSessionPageProps) {
  const { slug } = await params;
  const session = await getSessionBySlug(slug);

  if (!session) {
    notFound();
  }

  const groups = await getPublicGroupsForSession(session.id);
  const totalSeatsRemaining = groups.reduce(
    (count, group) =>
      count + Math.max(0, group.capacity - group.members.length),
    0
  );
  const joinCtaLabel = session.groupSelectionLocked ? 'View groups' : 'Join or switch group';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <header className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Student session
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {session.title}
          </h1>
          {session.instructions ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {session.instructions}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            href={`/s/${slug}/join`}
          >
            {joinCtaLabel}
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

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Groups</h2>
          <div className="text-sm text-slate-600">Seats remaining: {totalSeatsRemaining}</div>
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
