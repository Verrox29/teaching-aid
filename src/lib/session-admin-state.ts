import { eq } from 'drizzle-orm';

import { db, sessions } from '@/db';
import {
  getSessionExportMetadataRecord,
  getSessionExportMetadataUndoAvailability
} from '@/lib/exports/repository';

export type SessionAdminHeaderState = {
  assignmentBrief: string;
  canUndoAssignmentBrief: boolean;
  canUndoSessionContext: boolean;
  sessionContext: Awaited<ReturnType<typeof getSessionExportMetadataRecord>>;
  sessionTitle: string;
};

export async function getSessionAdminHeaderState(
  sessionId: string
): Promise<SessionAdminHeaderState> {
  const sessionRow = await db
    .select({
      title: sessions.title,
      instructions: sessions.instructions,
      instructionsPrevious: sessions.instructionsPrevious
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const [sessionContext, canUndoSessionContext] = await Promise.all([
    getSessionExportMetadataRecord(sessionId, sessionRow?.title ?? ''),
    getSessionExportMetadataUndoAvailability(sessionId)
  ]);

  return {
    assignmentBrief: sessionRow?.instructions ?? '',
    canUndoAssignmentBrief: Boolean(sessionRow?.instructionsPrevious),
    canUndoSessionContext,
    sessionContext,
    sessionTitle: sessionRow?.title ?? ''
  };
}
