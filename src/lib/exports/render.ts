import ExcelJS from 'exceljs';

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
  groupMembers: Array<{
    firstName: string;
    gradeAdjustment: number;
    lastName: string;
    schoolEmail: string;
  }>;
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

function columnToNumber(column: string) {
  let result = 0;
  for (const char of column.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }
  return result;
}

function numberToColumn(columnNumber: number) {
  let value = columnNumber;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function shiftCellAddress(address: string, rowOffset: number, columnOffset = 0) {
  if (rowOffset === 0 && columnOffset === 0) {
    return address;
  }

  const match = address.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return address;
  }

  const columnNumber = columnToNumber(match[1]) + columnOffset;
  const rowNumber = Number(match[2]) + rowOffset;
  if (columnNumber < 1 || rowNumber < 1) {
    return address;
  }

  return `${numberToColumn(columnNumber)}${rowNumber}`;
}

function shiftRangeAddress(range: string, rowOffset: number) {
  if (rowOffset === 0) {
    return range;
  }

  const match = range.match(/^([A-Z]+\d+):([A-Z]+\d+)$/);
  if (!match) {
    return range;
  }

  return `${shiftCellAddress(match[1], rowOffset)}:${shiftCellAddress(match[2], rowOffset)}`;
}

function shiftFormulaRows(formula: string, rowOffset: number) {
  if (rowOffset === 0) {
    return formula;
  }

  return formula.replace(
    /(^|[^A-Z0-9_])(\$?)([A-Z]{1,3})(\$?)(\d+)/g,
    (match, prefix: string, columnAbs: string, column: string, rowAbs: string, row: string) => {
      if (rowAbs === '$') {
        return match;
      }

      return `${prefix}${columnAbs}${column}${rowAbs}${Number(row) + rowOffset}`;
    }
  );
}

function sanitizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function sanitizeSheetName(value: string) {
  const cleaned = value.replace(/[\[\]\*\/\\\?:]/g, ' ').trim();
  return cleaned.slice(0, 31) || 'Group';
}

function cloneWorksheetModel(
  workbook: ExcelJS.Workbook,
  sourceModel: ExcelJS.Worksheet['model'],
  sheetName: string
) {
  const clone = workbook.addWorksheet(sheetName);
  clone.model = {
    ...structuredClone(sourceModel),
    name: sheetName
  };
  return clone;
}

function setCell(
  sheet: ExcelJS.Worksheet,
  address: string,
  value: string | number | null | undefined
) {
  sheet.getCell(address).value = value === null || value === undefined || value === '' ? null : value;
}

function setFormulaCell(
  sheet: ExcelJS.Worksheet,
  address: string,
  formula: string,
  result?: number
) {
  sheet.getCell(address).value =
    result === undefined ? { formula } : { formula, result };
}

function insertStyledRows(sheet: ExcelJS.Worksheet, startRow: number, count: number) {
  if (count <= 0) {
    return;
  }

  const rows = Array.from({ length: count }, () => []);
  sheet.insertRows(startRow, rows, 'i+');
}

function copyRowStyle(sheet: ExcelJS.Worksheet, sourceRow: number, targetRow: number) {
  if (sourceRow === targetRow) {
    return;
  }

  const source = sheet.getRow(sourceRow);
  const target = sheet.getRow(targetRow);
  target.height = source.height;
  source.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    target.getCell(colNumber).style = structuredClone(cell.style);
  });
}

function extendWorksheetRows(sheet: ExcelJS.Worksheet, additionalRows: number, sourceRow: number) {
  if (additionalRows <= 0) {
    return;
  }

  const insertAt = sourceRow + 1;
  insertStyledRows(sheet, insertAt, additionalRows);
  for (let offset = 0; offset < additionalRows; offset += 1) {
    copyRowStyle(sheet, sourceRow, insertAt + offset);
  }
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
      address: shiftCellAddress(mapping.finalScoreCell.address, rowOffset),
      formula: shiftFormulaRows(mapping.finalScoreCell.formula, rowOffset)
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
          address: shiftCellAddress(mapping.rubricBlocks.block1.subtotalCell.address, rowOffset),
          formula: shiftFormulaRows(mapping.rubricBlocks.block1.subtotalCell.formula, rowOffset)
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
          address: shiftCellAddress(mapping.rubricBlocks.block2.subtotalCell.address, rowOffset),
          formula: shiftFormulaRows(mapping.rubricBlocks.block2.subtotalCell.formula, rowOffset)
        },
        totalOutOfCell: {
          ...mapping.rubricBlocks.block2.totalOutOfCell,
          address: shiftCellAddress(mapping.rubricBlocks.block2.totalOutOfCell.address, rowOffset)
        }
      }
    }
  };
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
    group.groupMembers.map((member) => {
      return {
        firstName: member.firstName,
        groupName: group.groupName,
        lastName: member.lastName,
        remarks: sanitizeText(group.finalFeedback),
        totalScore:
          group.totalScore === null || group.totalScore === undefined
            ? null
            : group.totalScore + member.gradeAdjustment
      };
    })
  );
}

function fillReportSheet(
  sheet: ExcelJS.Worksheet,
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
  sheet: ExcelJS.Worksheet,
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

  setFormulaCell(
    sheet,
    block.subtotalCell.address,
    block.subtotalCell.formula,
    mode === 'debug' ? undefined : subtotal
  );
}

function fillGroupSheet(
  sheet: ExcelJS.Worksheet,
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
  const studentCount = input.groupMembers.length;
  const extraStudentRows = Math.max(0, studentCount - baseStudentRows);
  const layout = shiftGroupSheetMapping(mapping, extraStudentRows);

  if (extraStudentRows > 0) {
    insertStyledRows(sheet, layout.studentNames.startRow + baseStudentRows, extraStudentRows);
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
    mode === 'debug' ? 'group.titleLine' : sheet.getCell(mapping.titleLine.address).text
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
        : `${input.groupMembers[index]?.firstName ?? ''} ${input.groupMembers[index]?.lastName ?? ''}`.trim()
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

  setFormulaCell(
    sheet,
    layout.finalScoreCell.address,
    layout.finalScoreCell.formula,
    mode === 'debug'
      ? undefined
      : input.totalScore ?? input.criteria.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0)
  );

  if (mode === 'debug') {
    setCell(sheet, shiftCellAddress(layout.finalScoreCell.address, 0, -1), 'group.totalScore');
    setCell(sheet, layout.comments.address, 'group.comments');
    return;
  }

  setCell(sheet, layout.comments.address, sanitizeText(input.finalFeedback));
}

function buildGroupSheetName(_input: PairagogieGroupExportInput, index: number) {
  return sanitizeSheetName(`Group ${index + 1}`);
}

export async function renderPairagogieWorkbookBuffer(
  templateBuffer: Buffer,
  mapping: PairagogieExportMapping,
  input: PairagogieWorkbookInput,
  options: { mode?: PairagogieRenderMode } = {}
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer as any);
  const reportTemplate = workbook.getWorksheet(mapping.reportSheet.name);
  const groupTemplate = workbook.getWorksheet(mapping.groupSheet.nameTemplate);

  if (!reportTemplate) {
    throw new Error(`Missing required report sheet "${mapping.reportSheet.name}".`);
  }

  if (!groupTemplate) {
    throw new Error(`Missing required group template sheet "${mapping.groupSheet.nameTemplate}".`);
  }

  const mode = options.mode ?? 'normal';
  fillReportSheet(reportTemplate, mapping.reportSheet, input, mode);
  const groupTemplateModel = structuredClone(groupTemplate.model);

  const usedSheetNames = new Set<string>([mapping.reportSheet.name]);

  input.groups.forEach((group, index) => {
    const desiredSheetName = buildGroupSheetName(group, index);
    const sheetName = desiredSheetName;
    const groupSheet =
      index === 0
        ? groupTemplate
        : cloneWorksheetModel(workbook, groupTemplateModel, sheetName);

    if (index === 0) {
      groupSheet.name = sheetName;
    }

    let finalSheetName = groupSheet.name;
    let suffix = 2;
    while (usedSheetNames.has(finalSheetName)) {
      finalSheetName = sanitizeSheetName(`${desiredSheetName} ${suffix}`);
      suffix += 1;
    }
    if (finalSheetName !== groupSheet.name) {
      groupSheet.name = finalSheetName;
    }

    usedSheetNames.add(groupSheet.name);
    fillGroupSheet(groupSheet, mapping.groupSheet, group, input.session, mode);
  });

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output as any);
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
  return renderDelimitedCsvBuffer(rows);
}

export function renderDelimitedCsvBuffer(
  rows: Array<Record<string, string | number | null | undefined>>
) {
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
