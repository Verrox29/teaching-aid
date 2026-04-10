import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin-shell';
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
    <AdminShell
      actions={
        <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}`}>
          Session hub
        </Link>
      }
      currentStep={6}
      description="Reserved for grille and grades export in a later module."
      sessionId={sessionId}
      slug={session.slug}
      subtitle="Grille & grades export"
      title={session.title}
    >
      <section className="ui-panel p-6">
        <h2 className="text-lg font-semibold">Export module coming soon</h2>
        <p className="mt-2 text-sm text-[color:var(--app-fg-muted)]">
          Export tools will be added here in the next module.
        </p>
      </section>
    </AdminShell>
  );
}
