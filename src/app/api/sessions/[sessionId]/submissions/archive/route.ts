import { asc, eq } from 'drizzle-orm';
import JSZip from 'jszip';
import { NextResponse } from 'next/server';

import { db, groups, sessions, submissions } from '@/db';

function jsonError(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

function getGroupSortKey(groupName: string) {
  const match = /^Group\s+(\d+)$/i.exec(groupName.trim());
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function sanitizePathSegment(value: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]/g, '-');
  return cleaned || 'file';
}

function encodeFilename(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const [sessionRows, submissionRows] = await Promise.all([
    db
      .select({
        title: sessions.title
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1),
    db
      .select({
        content: submissions.content,
        fileName: submissions.title,
        groupName: groups.name
      })
      .from(submissions)
      .innerJoin(groups, eq(groups.id, submissions.groupId))
      .where(eq(submissions.sessionId, sessionId))
  ]);

  if (submissionRows.length === 0) {
    return jsonError(404, 'No submissions found.');
  }

  const zip = new JSZip();
  const sortedRows = [...submissionRows].sort((left, right) => {
    const leftOrder = getGroupSortKey(left.groupName);
    const rightOrder = getGroupSortKey(right.groupName);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.groupName.localeCompare(right.groupName, 'en', { sensitivity: 'base' });
  });

  for (const submission of sortedRows) {
    if (!submission.content) {
      continue;
    }

    zip.file(
      `${sanitizePathSegment(submission.groupName)}/${sanitizePathSegment(submission.fileName)}`,
      Buffer.from(submission.content, 'base64')
    );
  }

  const archiveBuffer = await zip.generateAsync({
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    type: 'nodebuffer'
  });

  const archiveName = `${sanitizePathSegment(sessionRows[0]?.title ?? `session-${sessionId}`)}-student-work.zip`;
  const encodedArchiveName = encodeFilename(archiveName);
  const archiveBytes = new Uint8Array(archiveBuffer);

  return new NextResponse(archiveBytes, {
    headers: {
      'content-disposition': `attachment; filename="${archiveName}"; filename*=UTF-8''${encodedArchiveName}`,
      'content-type': 'application/zip',
      'cache-control': 'no-store'
    }
  });
}
