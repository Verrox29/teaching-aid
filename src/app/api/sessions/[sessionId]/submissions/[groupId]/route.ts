import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { db, evaluations, groups, sessions, submissions } from '@/db';
import { GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES } from '@/lib/group-submission';

function jsonError(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

function encodeFilename(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

const orderPath = (sessionId: string) => `/sessions/${sessionId}/order`;
const groupsPath = (sessionId: string) => `/sessions/${sessionId}/groups`;
const evaluationPath = (sessionId: string) => `/sessions/${sessionId}/evaluation`;
const sessionHubPath = (sessionId: string) => `/sessions/${sessionId}`;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string; sessionId: string }> }
) {
  const { groupId, sessionId } = await params;

  const rows = await db
    .select({
      content: submissions.content,
      fileName: submissions.title
    })
    .from(submissions)
    .innerJoin(groups, eq(groups.id, submissions.groupId))
    .where(and(eq(submissions.sessionId, sessionId), eq(submissions.groupId, groupId), eq(groups.sessionId, sessionId)))
    .limit(1);

  const submission = rows[0] ?? null;
  if (!submission || !submission.content) {
    return jsonError(404, 'Submission not found.');
  }

  const fileBuffer = Buffer.from(submission.content, 'base64');
  const encodedFileName = encodeFilename(submission.fileName);

  return new NextResponse(fileBuffer, {
    headers: {
      'content-disposition': `attachment; filename="${submission.fileName}"; filename*=UTF-8''${encodedFileName}`,
      'content-type': 'application/octet-stream',
      'cache-control': 'no-store'
    }
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string; sessionId: string }> }
) {
  const { groupId, sessionId } = await params;
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return jsonError(400, 'Please choose a file to upload.');
  }

  if (file.size > GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES) {
    return jsonError(
      400,
      `File is too large. Max file size is ${GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
    );
  }

  const sessionRows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!sessionRows[0]) {
    return jsonError(404, 'Session not found.');
  }

  const groupRows = await db
    .select({
      id: groups.id,
      name: groups.name
    })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.sessionId, sessionId)))
    .limit(1);

  const group = groupRows[0] ?? null;
  if (!group) {
    return jsonError(404, 'Group not found.');
  }

  const existingSubmissionRows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(and(eq(submissions.sessionId, sessionId), eq(submissions.groupId, group.id)))
    .limit(1);

  const now = new Date();
  const content = Buffer.from(await file.arrayBuffer()).toString('base64');
  let submissionId: string | null = null;

  await db.transaction(async (tx) => {
    if (existingSubmissionRows.length > 0) {
      await tx.delete(submissions).where(eq(submissions.id, existingSubmissionRows[0].id));
    }

    const insertedSubmission = await tx
      .insert(submissions)
      .values({
        content,
        groupId: group.id,
        sessionId,
        submittedAt: now,
        title: file.name
      })
      .returning({ id: submissions.id });

    submissionId = insertedSubmission[0]?.id ?? null;

    await tx
      .update(evaluations)
      .set({
        aiRecommendedQuestions: [],
        submissionId,
        updatedAt: now
      })
      .where(and(eq(evaluations.sessionId, sessionId), eq(evaluations.evaluatorGroupId, group.id)));
  });

  revalidatePath(orderPath(sessionId));
  revalidatePath(groupsPath(sessionId));
  revalidatePath(evaluationPath(sessionId));
  revalidatePath(sessionHubPath(sessionId));

  return NextResponse.json({
    fileName: file.name,
    groupName: group.name,
    message: `${file.name} uploaded for ${group.name}.`,
    submissionId,
    submittedAt: now.toISOString()
  });
}
