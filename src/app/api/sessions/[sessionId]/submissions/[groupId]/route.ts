import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db, groups, submissions } from '@/db';

function jsonError(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

function encodeFilename(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

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
