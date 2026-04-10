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

function clearVerticalRange(
  sheet: XLSX.WorkSheet,
  column: string,
  startRow: number,
  maxRows: number
) {
  for (let index = 0; index < maxRows; index += 1) {
    delete sheet[`${column}${startRow + index}`];
  }
}

function fillReportSheet(
  sheet: XLSX.WorkSheet,
  mapping: PairagogieExportMapping['reportSheet'],
  input: PairagogieWorkbookInput,
  mode: PairagogieRenderMode
) {
  const rows = buildStudentReportRows(input);
  const visibleRows = mode === 'debug'
    ? Math.max(
        rows.length,
        3
      )
    : rows.length;

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

  for (let index = 0; index < mapping.studentRows.maxRows; index += 1) {
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

  setCell(
    sheet,
    mapping.sessionFields.programme.address,
    mode === 'debug' ? 'group.programme' : sanitizeText(session.programme)
  );
  setCell(
    sheet,
    mapping.sessionFields.className.address,
    mode === 'debug' ? 'group.className' : sanitizeText(session.className)
  );
  setCell(
    sheet,
    mapping.sessionFields.subject.address,
    mode === 'debug' ? 'group.subject' : sanitizeText(session.subject)
  );

  setCell(
    sheet,
    mapping.titleLine.address,
    mode === 'debug' ? 'group.titleLine' : sheet[mapping.titleLine.address]?.v?.toString() ?? ''
  );

  clearVerticalRange(
    sheet,
    mapping.studentNames.column,
    mapping.studentNames.startRow,
    mapping.studentNames.maxRows
  );

  const studentLabelCount =
    mode === 'debug'
      ? Math.max(input.groupMemberNames.length, 3)
      : input.groupMemberNames.length;

  for (let index = 0; index < mapping.studentNames.maxRows; index += 1) {
    const rowNumber = mapping.studentNames.startRow + index;
    setCell(
      sheet,
      `${mapping.studentNames.column}${rowNumber}`,
      mode === 'debug'
        ? index < studentLabelCount
          ? `group.studentNames[${index + 1}]`
          : ''
        : input.groupMemberNames[index] ?? ''
    );
  }

  fillRubricBlock(
    sheet,
    mapping.rubricBlocks.block1,
    input.criteria,
    0,
    mode,
    'group.scores.block1'
  );
  fillRubricBlock(
    sheet,
    mapping.rubricBlocks.block2,
    input.criteria,
    mapping.rubricBlocks.block1.criteriaCount,
    mode,
    'group.scores.block2'
  );

  if (mode === 'debug') {
    setCell(sheet, 'C35', 'group.totalScore');
    setCell(sheet, mapping.comments.address, 'group.comments');
    return;
  }

  const totalScore = input.totalScore ?? input.criteria.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0);
  setFormulaCell(
    sheet,
    mapping.finalScoreCell.address,
    mapping.finalScoreCell.formula,
    totalScore
  );
  setCell(sheet, mapping.comments.address, sanitizeText(input.finalFeedback ?? input.teacherNotes));
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
