import { NextResponse } from 'next/server';

import { saveExportHistory } from '@/lib/exports/repository';
import { buildCriterionCsvColumns, renderGradesCsvBuffer } from '@/lib/exports/render';
import { getPairagogieExportContext } from '@/lib/exports/repository';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const context = await getPairagogieExportContext(sessionId);

  if (context.groups.length === 0) {
    return NextResponse.json({ errors: ['Create at least one group before exporting.'] }, { status: 400 });
  }

  const criteria = context.groups[0]?.criteria ?? [];
  const criterionColumns = buildCriterionCsvColumns(criteria);
  const criterionColumnBySortOrder = new Map(
    criteria.map((criterion, index) => [criterion.sortOrder, criterionColumns[index]] as const)
  );

  const rows = context.groups.map((group) => {
    const row: Record<string, string | number | null> = {
      className: context.metadata.className,
      finalFeedback: group.evaluation?.finalFeedback ?? group.evaluation?.comments ?? '',
      groupMemberCount: group.members.length,
      groupName: group.name,
      groupPresentationOrder: group.presentationOrder ?? '',
      professorName: context.metadata.professorName,
      programme: context.metadata.programme,
      season: context.metadata.season,
      sessionDate: context.metadata.sessionDate,
      subject: context.metadata.subject,
      submissionTitle: group.submission?.fileName ?? '',
      teacherNotes: group.evaluation?.teacherNotes ?? '',
      totalScore: group.evaluation?.totalScore ?? '',
      memberNames: group.members.map((member) => `${member.firstName} ${member.lastName}`).join(' | ')
    };

    for (const criterion of group.criteria) {
      const key = criterionColumnBySortOrder.get(criterion.sortOrder);
      if (key) {
        row[key.key] = criterion.score ?? '';
      }
    }

    return row;
  });

  const csvBuffer = renderGradesCsvBuffer(rows);

  await saveExportHistory({
    exportType: 'grades_csv',
    metadata: {
      columnCount: Object.keys(rows[0] ?? {}).length,
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
