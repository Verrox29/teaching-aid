import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db, sessions } from '@/db';
import { resolveSessionResumePath } from '@/lib/session-navigation';

type SessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = await params;
  const rows = await db
    .select({
      id: sessions.id
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (rows.length === 0) {
    notFound();
  }

  redirect(await resolveSessionResumePath(sessionId));
}
