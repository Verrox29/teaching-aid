import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { db, sessions } from '@/db';

type SessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
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
      <div className="space-y-2">
        <p className="text-sm text-slate-500">Session</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {session?.title ?? sessionId}
        </h1>
        <p className="text-sm text-slate-600">
          Use the links below to move into the session workflows.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          href={`/sessions/${sessionId}/students`}
        >
          <div className="text-sm font-medium text-slate-900">Students</div>
          <div className="text-sm text-slate-600">Import and review the student roster.</div>
        </Link>
        <Link
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          href={`/sessions/${sessionId}/groups`}
        >
          <div className="text-sm font-medium text-slate-900">Groups</div>
          <div className="text-sm text-slate-600">Create groups and manage memberships.</div>
        </Link>
        <Link
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          href={`/s/${session.slug}`}
        >
          <div className="text-sm font-medium text-slate-900">Public page</div>
          <div className="text-sm text-slate-600">Open the student self-selection flow.</div>
        </Link>
        <Link
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          href="/sessions"
        >
          <div className="text-sm font-medium text-slate-900">Back to sessions</div>
          <div className="text-sm text-slate-600">Return to the sessions list.</div>
        </Link>
      </div>
    </main>
  );
}
