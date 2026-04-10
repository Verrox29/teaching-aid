import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminTimelineNav } from '@/components/admin-timeline-nav';
import { db, sessions } from '@/db';

type SessionExportsPageProps = {
  params: Promise<{ sessionId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function SessionExportsPage({
  params
}: SessionExportsPageProps) {
  const { sessionId } = await params;

  const rows = await db
    .select({
      slug: sessions.slug,
      title: sessions.title
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const session = rows[0] ?? null;

  if (!session) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
      <AdminTimelineNav currentStep={6} sessionId={sessionId} slug={session.slug} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Grille & grades export</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{session.title}</h1>
          <p className="text-sm text-slate-600">
            Export tools will be added here in the next module.
          </p>
        </div>

        <Link
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          href={`/sessions/${sessionId}`}
        >
          Session hub
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Export module coming soon</h2>
        <p className="mt-2 text-sm text-slate-600">
          This page is reserved for the final grille and grades export flow.
        </p>
      </section>
    </main>
  );
}
