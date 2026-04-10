import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin-shell';
import { db, sessions } from '@/db';

type SessionEvaluationPageProps = {
  params: Promise<{ sessionId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function SessionEvaluationPage({
  params
}: SessionEvaluationPageProps) {
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
    <AdminShell
      actions={
        <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}`}>
          Session hub
        </Link>
      }
      currentStep={5}
      description="Reserved for AI scoring and feedback in a later module."
      sessionId={sessionId}
      slug={session.slug}
      subtitle="AI scoring & feedback"
      title={session.title}
    >
      <section className="ui-panel p-6">
        <h2 className="text-lg font-semibold">Coming soon</h2>
        <p className="mt-2 text-sm text-[color:var(--app-fg-muted)]">
          AI scoring and feedback will be added in a later module.
        </p>
      </section>
    </AdminShell>
  );
}
