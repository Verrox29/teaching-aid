import * as XLSX from 'xlsx';

import type {
  PairagogieExportMapping,
  PairagogieRubricBlockMapping,
  SessionExportMetadata
} from './types';

type EvaluationCriterionRow = {
  feedback?: string | null;
  label: string;
  maxScore: number;
  score?: number | null;
  sortOrder: number;
};

export type PairagogieGroupExportInput = {
  criteria: EvaluationCriterionRow[];
  finalFeedback?: string | null;
  groupMemberNames: string[];
  groupName: string;
  groupPresentationOrder?: number | null;
  submissionTitle?: string | null;
  teacherNotes?: string | null;
  totalScore?: number | null;
  challengeQuestions?: string | null;
};

type PairagogieWorkbookInput = {
  groups: PairagogieGroupExportInput[];
  session: SessionExportMetadata;
};

type PairagogieRenderMode = 'normal' | 'debug';

type ReportRowInput = {
  firstName: string;
  groupName: string;
  lastName: string;
  remarks: string;
  totalScore: number | null;
};

type SheetRange = ReturnType<typeof XLSX.utils.decode_range>;

type RowCopyOptions = {
  preserveValues?: boolean;
};

function getSheetRange(sheet: XLSX.WorkSheet): SheetRange | null {
  const ref = sheet['!ref'];
  return ref ? XLSX.utils.decode_range(ref) : null;
}

function shiftCellAddress(address: string, rowOffset: number) {
  if (rowOffset === 0) {
    return address;
  }

  const cell = XLSX.utils.decode_cell(address);
  return XLSX.utils.encode_cell({ c: cell.c, r: cell.r + rowOffset });
}

function shiftRangeAddress(range: string, rowOffset: number) {
  if (rowOffset === 0) {
    return range;
  }

  const decoded = XLSX.utils.decode_range(range);
  decoded.s.r += rowOffset;
  decoded.e.r += rowOffset;
  return XLSX.utils.encode_range(decoded);
}

function shiftMergedRange(merge: SheetRange, rowOffset: number) {
  return {
    e: {
      c: merge.e.c,
      r: merge.e.r + rowOffset
    },
    s: {
      c: merge.s.c,
      r: merge.s.r + rowOffset
    }
  };
}

function cloneCellObject(cell: XLSX.CellObject | undefined, preserveValues = true) {
  if (!cell) {
    return undefined;
  }

  const clone = structuredClone(cell) as XLSX.CellObject;
  if (preserveValues) {
    return clone;
  }

  delete clone.f;
  delete clone.v;
  delete clone.w;
  delete clone.l;
  delete clone.c;
  delete clone.r;
  clone.t = 'z';
  return clone;
}

function copyRow(
  sheet: XLSX.WorkSheet,
  sourceRow: number,
  targetRow: number,
  options: RowCopyOptions = {}
) {
  if (sourceRow === targetRow) {
    return;
  }

  const range = getSheetRange(sheet);
  if (!range) {
    return;
  }

  const preserveValues = options.preserveValues ?? true;
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const sourceAddress = XLSX.utils.encode_cell({ c: col, r: sourceRow - 1 });
    const targetAddress = XLSX.utils.encode_cell({ c: col, r: targetRow - 1 });
    const cloned = cloneCellObject(sheet[sourceAddress] as XLSX.CellObject | undefined, preserveValues);

    if (cloned) {
      sheet[targetAddress] = cloned;
    } else {
      delete sheet[targetAddress];
    }
  }

  const rows = (sheet['!rows'] ??= []);
  const sourceRowMeta = rows[sourceRow - 1];
  if (sourceRowMeta) {
    rows[targetRow - 1] = structuredClone(sourceRowMeta);
  } else {
    delete rows[targetRow - 1];
  }
}

function shiftWorksheetRows(sheet: XLSX.WorkSheet, startRow: number, rowOffset: number) {
  if (rowOffset <= 0) {
    return;
  }

  const range = getSheetRange(sheet);
  if (!range) {
    return;
  }

  const cells = Object.keys(sheet)
    .filter((address) => !address.startsWith('!'))
    .map((address) => ({
      address,
      cell: XLSX.utils.decode_cell(address)
    }))
    .filter(({ cell }) => cell.r + 1 >= startRow)
    .sort((left, right) => {
      if (left.cell.r !== right.cell.r) {
        return right.cell.r - left.cell.r;
      }
      return right.cell.c - left.cell.c;
    });

  for (const { address, cell } of cells) {
    const targetAddress = XLSX.utils.encode_cell({ c: cell.c, r: cell.r + rowOffset });
    sheet[targetAddress] = structuredClone(sheet[address]) as XLSX.CellObject;
    delete sheet[address];
  }

  const rows = sheet['!rows'] ?? [];
  for (let rowIndex = rows.length - 1; rowIndex >= startRow - 1; rowIndex -= 1) {
    const sourceRowMeta = rows[rowIndex];
    if (sourceRowMeta) {
      rows[rowIndex + rowOffset] = structuredClone(sourceRowMeta);
    } else {
      delete rows[rowIndex + rowOffset];
    }
    delete rows[rowIndex];
  }
  sheet['!rows'] = rows;

  const merges = sheet['!merges'] ?? [];
  sheet['!merges'] = merges.map((merge) =>
    merge.s.r + 1 >= startRow ? shiftMergedRange(merge, rowOffset) : merge
  );

  range.e.r += rowOffset;
  sheet['!ref'] = XLSX.utils.encode_range(range);
}

function copyRowStyles(
  sheet: XLSX.WorkSheet,
  sourceRow: number,
  targetRow: number,
  options: { preserveValues?: boolean } = {}
) {
  copyRow(sheet, sourceRow, targetRow, options);
}

function extendWorksheetRows(sheet: XLSX.WorkSheet, additionalRows: number, sourceRow: number) {
  if (additionalRows <= 0) {
    return;
  }

  const range = getSheetRange(sheet);
  if (!range) {
    return;
  }

  const currentLastRow = range.e.r + 1;
  for (let offset = 1; offset <= additionalRows; offset += 1) {
    copyRowStyles(sheet, sourceRow, currentLastRow + offset, { preserveValues: false });
  }

  range.e.r += additionalRows;
  sheet['!ref'] = XLSX.utils.encode_range(range);
}

function shiftGroupSheetMapping(
  mapping: PairagogieExportMapping['groupSheet'],
  rowOffset: number
): PairagogieExportMapping['groupSheet'] {
  if (rowOffset === 0) {
    return mapping;
  }

  return {
    ...mapping,
    comments: {
      ...mapping.comments,
      address: shiftCellAddress(mapping.comments.address, rowOffset),
      range: shiftRangeAddress(mapping.comments.range, rowOffset)
    },
    finalScoreCell: {
      ...mapping.finalScoreCell,
      address: shiftCellAddress(mapping.finalScoreCell.address, rowOffset)
    },
    rubricBlocks: {
      block1: {
        ...mapping.rubricBlocks.block1,
        sectionTitle: {
          ...mapping.rubricBlocks.block1.sectionTitle,
          address: shiftCellAddress(mapping.rubricBlocks.block1.sectionTitle.address, rowOffset)
        },
        startRow: mapping.rubricBlocks.block1.startRow + rowOffset,
        subtotalCell: {
          ...mapping.rubricBlocks.block1.subtotalCell,
          address: shiftCellAddress(mapping.rubricBlocks.block1.subtotalCell.address, rowOffset)
        },
        totalOutOfCell: {
          ...mapping.rubricBlocks.block1.totalOutOfCell,
          address: shiftCellAddress(mapping.rubricBlocks.block1.totalOutOfCell.address, rowOffset)
        }
      },
      block2: {
        ...mapping.rubricBlocks.block2,
        sectionTitle: {
          ...mapping.rubricBlocks.block2.sectionTitle,
          address: shiftCellAddress(mapping.rubricBlocks.block2.sectionTitle.address, rowOffset)
        },
        startRow: mapping.rubricBlocks.block2.startRow + rowOffset,
        subtotalCell: {
          ...mapping.rubricBlocks.block2.subtotalCell,
          address: shiftCellAddress(mapping.rubricBlocks.block2.subtotalCell.address, rowOffset)
        },
        totalOutOfCell: {
          ...mapping.rubricBlocks.block2.totalOutOfCell,
          address: shiftCellAddress(mapping.rubricBlocks.block2.totalOutOfCell.address, rowOffset)
        }
      }
    }
  };
}

function setCell(sheet: XLSX.WorkSheet, address: string, value: string | number | null | undefined) {
  const cell = (sheet[address] ?? {}) as XLSX.CellObject;
  if (value === null || value === undefined || value === '') {
    cell.t = 's';
    cell.v = '';
    delete cell.f;
    sheet[address] = cell;
    return;
  }

  cell.t = typeof value === 'number' ? 'n' : 's';
  cell.v = value;
  delete cell.f;
  sheet[address] = cell;
}

function setFormulaCell(sheet: XLSX.WorkSheet, address: string, formula: string, value: number) {
  const cell = (sheet[address] ?? {}) as XLSX.CellObject;
  cell.t = 'n';
  cell.f = formula;
  cell.v = value;
  sheet[address] = cell;
}

function sanitizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function sanitizeSheetName(value: string) {
  const cleaned = value.replace(/[\[\]\*\/\\\?:]/g, ' ').trim();
  return cleaned.slice(0, 31) || 'Group';
}

function buildSubjectProgramme(metadata: SessionExportMetadata) {
  const subject = sanitizeText(metadata.subject);
  const programme = sanitizeText(metadata.programme);
  if (subject && programme) {
    return `${subject} - ${programme}`;
  }
  return subject || programme;
}

function buildStudentReportRows(input: PairagogieWorkbookInput): ReportRowInput[] {
  return input.groups.flatMap((group) =>
    group.groupMemberNames.map((memberName) => {
      const [firstName, ...lastNameParts] = memberName.trim().split(/\s+/);
      return {
        firstName: firstName ?? '',
        groupName: group.groupName,
        lastName: lastNameParts.join(' '),
        remarks: sanitizeText(group.finalFeedback ?? group.teacherNotes),
        totalScore: group.totalScore ?? null
      };
    })
  );
}

function fillReportSheet(
  sheet: XLSX.WorkSheet,
  mapping: PairagogieExportMapping['reportSheet'],
  input: PairagogieWorkbookInput,
  mode: PairagogieRenderMode
) {
  const rows = buildStudentReportRows(input);
  const visibleRows = mode === 'debug' ? Math.max(rows.length, 3) : rows.length;
  const rowCount = Math.max(mapping.studentRows.maxRows, rows.length);

  if (rowCount > mapping.studentRows.maxRows) {
    extendWorksheetRows(
      sheet,
      rowCount - mapping.studentRows.maxRows,
      mapping.studentRows.startRow + mapping.studentRows.maxRows - 1
    );
  }

  setCell(
    sheet,
    mapping.header.professorName.address,
    mode === 'debug' ? 'report.professorName' : sanitizeText(input.session.professorName)
  );
  setCell(
    sheet,
    mapping.header.sessionDate.address,
    mode === 'debug' ? 'report.sessionDate' : sanitizeText(input.session.sessionDate)
  );
  setCell(
    sheet,
    mapping.header.subjectProgramme.address,
    mode === 'debug' ? 'report.subject + report.programme' : buildSubjectProgramme(input.session)
  );
  setCell(
    sheet,
    mapping.header.className.address,
    mode === 'debug' ? 'report.className' : sanitizeText(input.session.className)
  );
  setCell(
    sheet,
    mapping.header.season.address,
    mode === 'debug' ? 'report.season' : sanitizeText(input.session.season)
  );

  for (let index = 0; index < rowCount; index += 1) {
    const rowNumber = mapping.studentRows.startRow + index;
    const row = rows[index];
    const labelIndex = index + 1;
    setCell(
      sheet,
      `${mapping.studentRows.columns.firstName}${rowNumber}`,
      mode === 'debug'
        ? index < visibleRows
          ? `report.students[${labelIndex}].firstName`
          : ''
        : row?.firstName ?? ''
    );
    setCell(
      sheet,
      `${mapping.studentRows.columns.lastName}${rowNumber}`,
      mode === 'debug'
        ? index < visibleRows
          ? `report.students[${labelIndex}].lastName`
          : ''
        : row?.lastName ?? ''
    );
    setCell(
      sheet,
      `${mapping.studentRows.columns.groupName}${rowNumber}`,
      mode === 'debug'
        ? index < visibleRows
          ? `report.students[${labelIndex}].groupName`
          : ''
        : row?.groupName ?? ''
    );
    setCell(
      sheet,
      `${mapping.studentRows.columns.totalScore}${rowNumber}`,
      mode === 'debug'
        ? index < visibleRows
          ? `report.students[${labelIndex}].totalScore`
          : ''
        : row?.totalScore ?? ''
    );
    setCell(
      sheet,
      `${mapping.studentRows.columns.remarks}${rowNumber}`,
      mode === 'debug'
        ? index < visibleRows
          ? `report.students[${labelIndex}].remarks`
          : ''
        : row?.remarks ?? ''
    );
  }
}

function getCriteriaForBlock(
  criteria: EvaluationCriterionRow[],
  block: PairagogieRubricBlockMapping,
  blockOffset: number
) {
  return criteria.slice(blockOffset, blockOffset + block.criteriaCount);
}

function fillRubricBlock(
  sheet: XLSX.WorkSheet,
  block: PairagogieRubricBlockMapping,
  criteria: EvaluationCriterionRow[],
  offset: number,
  mode: PairagogieRenderMode,
  labelPrefix: string
) {
  const blockCriteria = getCriteriaForBlock(criteria, block, offset);
  let subtotal = 0;

  for (let index = 0; index < block.criteriaCount; index += 1) {
    const rowNumber = block.startRow + index;
    const criterion = blockCriteria[index];
    const scoreAddress = `${block.scoreColumn}${rowNumber}`;
    if (mode === 'debug') {
      setCell(sheet, scoreAddress, `${labelPrefix}[${index + 1}]`);
      continue;
    }

    const score = criterion?.score ?? null;
    if (score !== null) {
      subtotal += score;
    }
    setCell(sheet, scoreAddress, score ?? '');
  }

  if (mode === 'debug') {
    return;
  }

  setFormulaCell(sheet, block.subtotalCell.address, block.subtotalCell.formula, subtotal);
}

function fillGroupSheet(
  sheet: XLSX.WorkSheet,
  mapping: PairagogieExportMapping['groupSheet'],
  input: PairagogieGroupExportInput,
  session: SessionExportMetadata,
  mode: PairagogieRenderMode
) {
  const rubricCapacity =
    mapping.rubricBlocks.block1.criteriaCount + mapping.rubricBlocks.block2.criteriaCount;
  if (input.criteria.length > rubricCapacity) {
    throw new Error(
      `Group "${input.groupName}" has ${input.criteria.length} criteria, but the template only supports ${rubricCapacity}.`
    );
  }

  const baseStudentRows = mapping.studentNames.maxRows;
  const studentCount = input.groupMemberNames.length;
  const extraStudentRows = Math.max(0, studentCount - baseStudentRows);
  const layout = shiftGroupSheetMapping(mapping, extraStudentRows);

  if (extraStudentRows > 0) {
    shiftWorksheetRows(sheet, layout.studentNames.startRow + baseStudentRows, extraStudentRows);

    const genericStudentRow = layout.studentNames.startRow + baseStudentRows - 2;
    const finalStudentRow = layout.studentNames.startRow + baseStudentRows - 1;
    for (let index = 0; index < extraStudentRows; index += 1) {
      const targetRow = layout.studentNames.startRow + baseStudentRows + index;
      const sourceRow = index === extraStudentRows - 1 ? finalStudentRow : genericStudentRow;
      copyRowStyles(sheet, sourceRow, targetRow, { preserveValues: false });
    }
  }

  setCell(
    sheet,
    layout.sessionFields.programme.address,
    mode === 'debug' ? 'group.programme' : sanitizeText(session.programme)
  );
  setCell(
    sheet,
    layout.sessionFields.className.address,
    mode === 'debug' ? 'group.className' : sanitizeText(session.className)
  );
  setCell(
    sheet,
    layout.sessionFields.subject.address,
    mode === 'debug' ? 'group.subject' : sanitizeText(session.subject)
  );

  setCell(
    sheet,
    layout.titleLine.address,
    mode === 'debug' ? 'group.titleLine' : sheet[mapping.titleLine.address]?.v?.toString() ?? ''
  );

  const studentRowCount = Math.max(baseStudentRows, studentCount);
  const visibleStudentRows = mode === 'debug' ? studentRowCount : studentCount;

  for (let index = 0; index < studentRowCount; index += 1) {
    const rowNumber = layout.studentNames.startRow + index;
    setCell(
      sheet,
      `${layout.studentNames.column}${rowNumber}`,
      mode === 'debug'
        ? index < visibleStudentRows
          ? `group.studentNames[${index + 1}]`
          : ''
        : input.groupMemberNames[index] ?? ''
    );
  }

  fillRubricBlock(
    sheet,
    layout.rubricBlocks.block1,
    input.criteria,
    0,
    mode,
    'group.scores.block1'
  );
  fillRubricBlock(
    sheet,
    layout.rubricBlocks.block2,
    input.criteria,
    layout.rubricBlocks.block1.criteriaCount,
    mode,
    'group.scores.block2'
  );

  if (mode === 'debug') {
    setCell(sheet, layout.finalScoreCell.address.replace(/^D/, 'C'), 'group.totalScore');
    setCell(sheet, layout.comments.address, 'group.comments');
    return;
  }

  const totalScore = input.totalScore ?? input.criteria.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0);
  setFormulaCell(
    sheet,
    layout.finalScoreCell.address,
    layout.finalScoreCell.formula,
    totalScore
  );
  setCell(sheet, layout.comments.address, sanitizeText(input.finalFeedback ?? input.teacherNotes));
}

function buildGroupSheetName(input: PairagogieGroupExportInput, index: number) {
  const presentationOrder = input.groupPresentationOrder ?? index + 1;
  return sanitizeSheetName(`Group ${presentationOrder}`);
}

export function renderPairagogieWorkbookBuffer(
  templateBuffer: Buffer,
  mapping: PairagogieExportMapping,
  input: PairagogieWorkbookInput,
  options: { mode?: PairagogieRenderMode } = {}
) {
  const workbook = XLSX.read(templateBuffer, { cellFormula: true, cellStyles: true });
  const reportTemplate = workbook.Sheets[mapping.reportSheet.name];
  const groupTemplate = workbook.Sheets[mapping.groupSheet.nameTemplate];

  if (!reportTemplate) {
    throw new Error(`Missing required report sheet "${mapping.reportSheet.name}".`);
  }

  if (!groupTemplate) {
    throw new Error(`Missing required group template sheet "${mapping.groupSheet.nameTemplate}".`);
  }

  const mode = options.mode ?? 'normal';
  const reportSheet = structuredClone(reportTemplate) as XLSX.WorkSheet;
  fillReportSheet(reportSheet, mapping.reportSheet, input, mode);

  const sheetEntries: Array<[string, XLSX.WorkSheet]> = [[mapping.reportSheet.name, reportSheet]];
  const usedSheetNames = new Set<string>([mapping.reportSheet.name]);

  input.groups.forEach((group, index) => {
    const clone = structuredClone(groupTemplate) as XLSX.WorkSheet;
    fillGroupSheet(clone, mapping.groupSheet, group, input.session, mode);

    const baseName = buildGroupSheetName(group, index);
    let sheetName = baseName;
    let suffix = 2;
    while (usedSheetNames.has(sheetName)) {
      sheetName = sanitizeSheetName(`${baseName} ${suffix}`);
      suffix += 1;
    }

    usedSheetNames.add(sheetName);
    sheetEntries.push([sheetName, clone]);
  });

  workbook.SheetNames = sheetEntries.map(([sheetName]) => sheetName);
  workbook.Sheets = Object.fromEntries(sheetEntries);

  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer', cellStyles: true });
  return output as Buffer;
}

function escapeCsv(value: string) {
  const text = value.replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function slugifyColumn(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function renderGradesCsvBuffer(rows: Array<Record<string, string | number | null | undefined>>) {
  if (rows.length === 0) {
    return Buffer.from('', 'utf8');
  }

  const headers = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      headers.add(key);
    }
  }

  const orderedHeaders = Array.from(headers);
  const lines = [
    orderedHeaders.map(escapeCsv).join(','),
    ...rows.map((row) =>
      orderedHeaders
        .map((header) => {
          const value = row[header];
          return escapeCsv(value === null || value === undefined ? '' : String(value));
        })
        .join(',')
    )
  ];

  return Buffer.from(lines.join('\n'), 'utf8');
}

export function buildCriterionCsvColumns(criteria: EvaluationCriterionRow[]) {
  return criteria.map((criterion) => ({
    header: `${criterion.sortOrder + 1}. ${criterion.label}`,
    key: slugifyColumn(criterion.label) || `criterion_${criterion.sortOrder + 1}`
  }));
}
