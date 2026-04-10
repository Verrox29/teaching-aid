import { NextResponse } from 'next/server';

import { saveExportHistory } from '@/lib/exports/repository';
import { renderPairagogieWorkbookBuffer } from '@/lib/exports/render';
import { getPairagogieExportContext } from '@/lib/exports/repository';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const context = await getPairagogieExportContext(sessionId);
  const searchParams = new URL(request.url).searchParams;
  const isDebug = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true';

  if (context.validationIssues.length > 0) {
    return NextResponse.json(
      { errors: context.validationIssues },
      { status: 422 }
    );
  }

  if (context.groups.length === 0) {
    return NextResponse.json({ errors: ['Create at least one group before exporting.'] }, { status: 400 });
  }

  const templateBuffer = Buffer.from(context.template.contentBase64, 'base64');
  const workbookBuffer = await renderPairagogieWorkbookBuffer(templateBuffer, context.mapping, {
    groups: context.groups.map((group) => ({
      challengeQuestions: null,
      criteria: group.criteria,
      finalFeedback: group.evaluation?.finalFeedback ?? null,
      groupMemberNames: group.members.map((member) => `${member.firstName} ${member.lastName}`),
      groupName: group.name,
      groupPresentationOrder: group.presentationOrder,
      submissionTitle: group.submission?.fileName ?? null,
      teacherNotes: group.evaluation?.teacherNotes ?? null,
      totalScore: group.evaluation?.totalScore ?? null
    })),
    session: context.metadata
  }, {
    mode: isDebug ? 'debug' : 'normal'
  });

  await saveExportHistory({
    exportType: isDebug ? 'pairagogie_xlsx_debug' : 'pairagogie_xlsx',
    metadata: {
      debug: isDebug,
      mappingVersion: context.version.mapping,
      rowCount: context.groups.length,
      templateVersion: context.version.template
    },
    sessionId
  });

  return new NextResponse(new Uint8Array(workbookBuffer), {
    headers: {
      'Content-Disposition': `attachment; filename="pairagogie${isDebug ? '-debug' : ''}-${context.session.slug}.xlsx"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });
}
