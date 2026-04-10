import { NextResponse } from 'next/server';

import { saveExportHistory } from '@/lib/exports/repository';
import { renderDelimitedCsvBuffer } from '@/lib/exports/render';
import { getPairagogieExportContext } from '@/lib/exports/repository';

export const runtime = 'nodejs';

function buildGroupName(className: string, groupNumber: number) {
  return `${className} - Group ${groupNumber}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const context = await getPairagogieExportContext(sessionId);

  if (context.groups.length === 0) {
    return NextResponse.json({ errors: ['Create at least one group before exporting.'] }, { status: 400 });
  }

  const rows = context.groups.flatMap((group, index) => {
    const groupNumber = group.presentationOrder ?? index + 1;
    const groupName = buildGroupName(context.metadata.className, groupNumber);

    return group.members.map((member) => ({
      nom: member.lastName,
      prenom: member.firstName,
      username: member.schoolEmail,
      code_groupe: groupName,
      nom_groupe: groupName,
      operation: 'AJOUT'
    }));
  });

  const csvBuffer = renderDelimitedCsvBuffer(rows);

  await saveExportHistory({
    exportType: 'groups_csv',
    metadata: {
      columnCount: 6,
      rowCount: rows.length
    },
    sessionId
  });

  return new NextResponse(csvBuffer, {
    headers: {
      'Content-Disposition': `attachment; filename="groups-${context.session.slug}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8'
    }
  });
}
