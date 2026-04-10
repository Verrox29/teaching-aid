import * as XLSX from 'xlsx';

import type { PairagogieExportMapping, SessionExportMetadata } from './types';

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

function setCell(sheet: XLSX.WorkSheet, address: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return;
  }

  sheet[address] = sheet[address] ?? { t: typeof value === 'number' ? 'n' : 's', v: value };
  sheet[address].v = value;
  sheet[address].t = typeof value === 'number' ? 'n' : 's';
}

function setRichMergedValue(sheet: XLSX.WorkSheet, address: string, value: string) {
  const cell = sheet[address] ?? { t: 's', v: value };
  cell.t = 's';
  cell.v = value;
  sheet[address] = cell;
}

function setFormulaCell(sheet: XLSX.WorkSheet, address: string, formula: string, value: number) {
  sheet[address] = {
    t: 'n',
    f: formula,
    v: value
  };
}

function sanitizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function sanitizeSheetName(value: string) {
  const cleaned = value.replace(/[\[\]\*\/\\\?:]/g, ' ').trim();
  return cleaned.slice(0, 31) || 'Pairagogie';
}

function fillPairagogieSheet(
  sheet: XLSX.WorkSheet,
  mapping: PairagogieExportMapping,
  input: PairagogieGroupExportInput,
  session: SessionExportMetadata
) {
  setCell(sheet, mapping.cells['session.programme'], sanitizeText(session.programme));
  setCell(sheet, mapping.cells['session.className'], sanitizeText(session.className));
  setCell(sheet, mapping.cells['session.subject'], sanitizeText(session.subject));
  setCell(sheet, mapping.cells['session.season'], sanitizeText(session.season));
  setCell(sheet, mapping.cells['session.professorName'], sanitizeText(session.professorName));
  setCell(sheet, mapping.cells['session.sessionDate'], sanitizeText(session.sessionDate));

  setCell(sheet, mapping.cells['group.name'], sanitizeText(input.groupName));
  setCell(
    sheet,
    mapping.cells['group.presentationOrder'],
    input.groupPresentationOrder === null || input.groupPresentationOrder === undefined
      ? ''
      : input.groupPresentationOrder
  );
  setCell(sheet, mapping.cells['group.submissionTitle'], sanitizeText(input.submissionTitle));
  setCell(sheet, mapping.cells['group.memberCount'], input.groupMemberNames.length);
  setRichMergedValue(sheet, mapping.cells['group.members'], input.groupMemberNames.join('\n'));

  const rubricStartRow = mapping.rubric.startRow;
  const rubricEndRow = rubricStartRow + mapping.rubric.maxRows - 1;

  for (let index = 0; index < mapping.rubric.maxRows; index += 1) {
    const row = rubricStartRow + index;
    const criterion = input.criteria[index];
    if (!criterion) {
      setCell(sheet, `${mapping.rubric.columns.label}${row}`, '');
      setCell(sheet, `${mapping.rubric.columns.maxScore}${row}`, '');
      setCell(sheet, `${mapping.rubric.columns.score}${row}`, '');
      setCell(sheet, `${mapping.rubric.columns.feedback}${row}`, '');
      setCell(sheet, `${mapping.rubric.columns.aiDraft}${row}`, '');
      continue;
    }

    setCell(sheet, `${mapping.rubric.columns.label}${row}`, sanitizeText(criterion.label));
    setCell(sheet, `${mapping.rubric.columns.maxScore}${row}`, criterion.maxScore);
    setCell(sheet, `${mapping.rubric.columns.score}${row}`, criterion.score ?? '');
    setCell(sheet, `${mapping.rubric.columns.feedback}${row}`, sanitizeText(criterion.feedback));
    setCell(sheet, `${mapping.rubric.columns.aiDraft}${row}`, '');
  }

  if (mapping.expectedFormulaCells.includes(mapping.cells['rubric.totalScore'])) {
    const scoreColumn = mapping.rubric.columns.score;
    setFormulaCell(
      sheet,
      mapping.cells['rubric.totalScore'],
      `SUM(${scoreColumn}${rubricStartRow}:${scoreColumn}${rubricEndRow})`,
      input.totalScore ?? 0
    );
  } else if (input.totalScore !== undefined && input.totalScore !== null) {
    setCell(sheet, mapping.cells['rubric.totalScore'], input.totalScore);
  }

  setRichMergedValue(sheet, mapping.cells['rubric.teacherNotes'], sanitizeText(input.teacherNotes));
  setRichMergedValue(sheet, mapping.cells['rubric.finalFeedback'], sanitizeText(input.finalFeedback));
  setRichMergedValue(
    sheet,
    mapping.cells['rubric.challengeQuestions'],
    sanitizeText(input.challengeQuestions)
  );
}

export function renderPairagogieWorkbookBuffer(
  templateBuffer: Buffer,
  mapping: PairagogieExportMapping,
  input: PairagogieWorkbookInput
) {
  const workbook = XLSX.read(templateBuffer, { cellFormula: true, cellStyles: true });
  const baseSheet = workbook.Sheets[mapping.sheetName];

  if (!baseSheet) {
    throw new Error(`Missing required sheet "${mapping.sheetName}".`);
  }

  const baseName = mapping.sheetName;
  const sheetEntries: Array<[string, XLSX.WorkSheet]> = [];

  input.groups.forEach((group, index) => {
    const clone = structuredClone(baseSheet) as XLSX.WorkSheet;
    fillPairagogieSheet(clone, mapping, group, input.session);
    const sheetName = sanitizeSheetName(`${group.groupName || baseName} ${index + 1}`);
    sheetEntries.push([sheetName, clone]);
  });

  workbook.SheetNames = sheetEntries.map(([sheetName]) => sheetName);
  workbook.Sheets = Object.fromEntries(sheetEntries);

  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
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
