import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin-shell';
import { EvaluationWorkspaceClient } from '@/components/evaluation-workspace';
import { SessionContextPopover } from '@/components/session-context-popover';
import { db, sessions } from '@/db';
import { getSessionExportMetadataRecord } from '@/lib/exports/repository';
import { getEvaluationWorkspace } from '@/lib/evaluation/repository';
import { recordSessionAdminPath } from '@/lib/session-navigation';

type SessionEvaluationPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SessionEvaluationPage({
  params,
  searchParams
}: SessionEvaluationPageProps) {
  const { sessionId } = await params;
  const search = searchParams ? await searchParams : {};
  const requestedGroupId = getSingleValue(search.groupId);

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

  await recordSessionAdminPath(sessionId, `/sessions/${sessionId}/evaluation`);

  const workspace = await getEvaluationWorkspace(sessionId);
  const metadata = await getSessionExportMetadataRecord(sessionId, session.title);
  const initialGroupId =
    requestedGroupId && workspace.groups.some((group) => group.groupId === requestedGroupId)
      ? requestedGroupId
      : workspace.groups[0]?.groupId ?? '';

  return (
    <AdminShell
      actions={
        <>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/order`}>
            Order
          </Link>
          <Link className="ui-button ui-button-secondary" href={`/sessions/${sessionId}/exports`}>
            Exports
          </Link>
          <SessionContextPopover
            metadata={metadata}
            roster={workspace.groups.map((group) => ({
              groupId: group.groupId,
              groupName: group.groupName,
              members: group.members
            }))}
          />
        </>
      }
      currentStep={4}
      description="Evaluate groups in presentation order, save live notes, and use batch or per-group AI support."
      sessionId={sessionId}
      slug={session.slug}
      subtitle="AI scoring & feedback"
      title={session.title}
    >
      <EvaluationWorkspaceClient
        groups={JSON.parse(JSON.stringify(workspace.groups))}
        initialGroupId={initialGroupId}
        sessionId={sessionId}
        sessionLanguage={workspace.session.language}
      />
    </AdminShell>
  );
}
