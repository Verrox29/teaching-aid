import { and, eq, isNotNull } from 'drizzle-orm';

import { db, evaluations, groups, sessionStudents, sessions, submissions } from '@/db';

function buildPath(sessionId: string, suffix: string) {
  return `/sessions/${sessionId}${suffix}`;
}

function isKnownSessionAdminPath(sessionId: string, path: string) {
  return [
    buildPath(sessionId, '/students'),
    buildPath(sessionId, '/groups'),
    buildPath(sessionId, '/evaluation'),
    buildPath(sessionId, '/exports'),
    buildPath(sessionId, '/exports/settings')
  ].includes(path);
}

export async function recordSessionAdminPath(sessionId: string, path: string): Promise<void> {
  if (!isKnownSessionAdminPath(sessionId, path)) {
    return;
  }

  await db
    .update(sessions)
    .set({
      lastAdminPath: path,
      updatedAt: new Date()
    })
    .where(eq(sessions.id, sessionId));
}

export async function resolveSessionResumePath(sessionId: string): Promise<string> {
  const sessionRows = await db
    .select({
      lastAdminPath: sessions.lastAdminPath
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const sessionRow = sessionRows[0] ?? null;
  const storedPath = sessionRow?.lastAdminPath ?? null;
  if (storedPath === buildPath(sessionId, '/order')) {
    return buildPath(sessionId, '/evaluation');
  }
  if (storedPath && isKnownSessionAdminPath(sessionId, storedPath)) {
    return storedPath;
  }

  const [studentRows, groupRows, orderedGroupRows, submissionRows, evaluationRows] = await Promise.all([
    db
      .select({ id: sessionStudents.id })
      .from(sessionStudents)
      .where(and(eq(sessionStudents.sessionId, sessionId), eq(sessionStudents.isIgnored, false)))
      .limit(1),
    db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.sessionId, sessionId))
      .limit(1),
    db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.sessionId, sessionId), isNotNull(groups.presentationOrder)))
      .limit(1),
    db
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.sessionId, sessionId))
      .limit(1),
    db
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(eq(evaluations.sessionId, sessionId))
      .limit(1)
  ]);

  if (evaluationRows.length > 0) {
    return buildPath(sessionId, '/evaluation');
  }

  if (orderedGroupRows.length > 0 || submissionRows.length > 0) {
    return buildPath(sessionId, '/evaluation');
  }

  if (groupRows.length > 0) {
    return buildPath(sessionId, '/groups');
  }

  if (studentRows.length > 0) {
    return buildPath(sessionId, '/students');
  }

  return buildPath(sessionId, '/students');
}
