import { NextResponse } from 'next/server';

import { saveExportHistory } from '@/lib/exports/repository';
import { renderDelimitedCsvBuffer } from '@/lib/exports/render';
import { getPairagogieExportContext } from '@/lib/exports/repository';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const context = await getPairagogieExportContext(sessionId);
  const groupTotalByGroupId = new Map(
    context.groups.map((group) => [group.id, group.evaluation?.totalScore ?? null])
  );

  if (context.groups.length === 0) {
    return NextResponse.json({ errors: ['Create at least one group before exporting.'] }, { status: 400 });
  }

  const rows = context.groups.flatMap((group) => {
    const groupTotal = groupTotalByGroupId.get(group.id) ?? null;

    return group.members.map((member) => ({
      'Adresse de courriel': member.schoolEmail,
      Note: groupTotal === null ? '' : groupTotal + member.gradeAdjustment,
      Commentaire: group.evaluation?.finalFeedback ?? ''
    }));
  });

  const csvBuffer = renderDelimitedCsvBuffer(rows);

  await saveExportHistory({
    exportType: 'grades_csv',
    metadata: {
      columnCount: 3,
      rowCount: rows.length
    },
    sessionId
  });

  return new NextResponse(csvBuffer, {
    headers: {
      'Content-Disposition': `attachment; filename="grades-${context.session.slug}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8'
    }
  });
}
