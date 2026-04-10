import * as XLSX from 'xlsx';

import type {
  ExportValidationIssue,
  ExportValidationResult,
  PairagogieExpectedLabel,
  PairagogieExportMapping,
  PairagogieFormulaCell
} from './types';

function hasMergedRange(sheet: XLSX.WorkSheet, range: string) {
  const merges = sheet['!merges'] ?? [];
  return merges.some((merge) => XLSX.utils.encode_range(merge) === range);
}

function cellExists(sheet: XLSX.WorkSheet, address: string) {
  if (sheet[address]) {
    return true;
  }

  const ref = sheet['!ref'];
  if (!ref) {
    return false;
  }

  const sheetRange = XLSX.utils.decode_range(ref);
  const cell = XLSX.utils.decode_cell(address);
  return (
    cell.r >= sheetRange.s.r &&
    cell.r <= sheetRange.e.r &&
    cell.c >= sheetRange.s.c &&
    cell.c <= sheetRange.e.c
  );
}

function readCellText(sheet: XLSX.WorkSheet, address: string) {
  const value = sheet[address]?.v;
  return value === undefined || value === null ? '' : String(value).trim();
}

function formulaMatches(sheet: XLSX.WorkSheet, formulaCell: PairagogieFormulaCell) {
  const cell = sheet[formulaCell.address] as XLSX.CellObject | undefined;
  return cell?.f?.replace(/\s+/g, '') === formulaCell.formula.replace(/\s+/g, '');
}

function validateExpectedLabels(
  issues: ExportValidationIssue[],
  sheet: XLSX.WorkSheet,
  sheetName: string,
  labels: PairagogieExpectedLabel[]
) {
  for (const label of labels) {
    const actual = readCellText(sheet, label.address);
    if (actual !== label.value) {
      issues.push({
        message: `Expected "${label.value}" at ${label.address}, found "${actual || '(blank)'}".`,
        target: `${sheetName}!${label.address}`
      });
    }
  }
}

export function validatePairagogieTemplateBuffer(
  buffer: Buffer,
  mapping: PairagogieExportMapping
): ExportValidationResult {
  const workbook = XLSX.read(buffer, { cellFormula: true, cellStyles: true });
  const issues: ExportValidationIssue[] = [];
  const reportSheet = workbook.Sheets[mapping.reportSheet.name];
  const groupSheet = workbook.Sheets[mapping.groupSheet.nameTemplate];

  if (!reportSheet) {
    issues.push({
      message: `Missing required report sheet "${mapping.reportSheet.name}".`,
      target: mapping.reportSheet.name
    });
  }

  if (!groupSheet) {
    issues.push({
      message: `Missing required group template sheet "${mapping.groupSheet.nameTemplate}".`,
      target: mapping.groupSheet.nameTemplate
    });
  }

  if (!reportSheet || !groupSheet) {
    return { issues, ok: false };
  }

  const reportRequiredAddresses = [
    mapping.reportSheet.header.professorName.address,
    mapping.reportSheet.header.sessionDate.address,
    mapping.reportSheet.header.subjectProgramme.address,
    mapping.reportSheet.header.className.address,
    mapping.reportSheet.header.season.address
  ];

  for (const address of reportRequiredAddresses) {
    if (!cellExists(reportSheet, address)) {
      issues.push({
        message: `Missing required report cell ${address}.`,
        target: `${mapping.reportSheet.name}!${address}`
      });
    }
  }

  for (const range of [
    mapping.reportSheet.header.professorName.range,
    mapping.reportSheet.header.subjectProgramme.range,
    mapping.groupSheet.sessionFields.programme.range,
    mapping.groupSheet.sessionFields.className.range,
    mapping.groupSheet.sessionFields.subject.range,
    mapping.groupSheet.comments.range
  ]) {
    const owner = range === mapping.reportSheet.header.professorName.range || range === mapping.reportSheet.header.subjectProgramme.range
      ? reportSheet
      : groupSheet;
    const ownerName = owner === reportSheet ? mapping.reportSheet.name : mapping.groupSheet.nameTemplate;
    if (!hasMergedRange(owner, range)) {
      issues.push({
        message: `Missing required merged range ${range}.`,
        target: `${ownerName}!${range}`
      });
    }
  }

  validateExpectedLabels(issues, reportSheet, mapping.reportSheet.name, mapping.reportSheet.expectedLabels);
  validateExpectedLabels(issues, groupSheet, mapping.groupSheet.nameTemplate, mapping.groupSheet.expectedLabels);

  for (const formulaCell of [
    mapping.groupSheet.rubricBlocks.block1.subtotalCell,
    mapping.groupSheet.rubricBlocks.block2.subtotalCell,
    mapping.groupSheet.finalScoreCell
  ]) {
    if (!formulaMatches(groupSheet, formulaCell)) {
      issues.push({
        message: `Formula mismatch at ${formulaCell.address}. Expected ${formulaCell.formula}.`,
        target: `${mapping.groupSheet.nameTemplate}!${formulaCell.address}`
      });
    }
  }

  const reportRange = reportSheet['!ref'] ? XLSX.utils.decode_range(reportSheet['!ref']) : null;
  const lastReportRowNeeded =
    mapping.reportSheet.studentRows.startRow + mapping.reportSheet.studentRows.maxRows - 1;
  if (reportRange && reportRange.e.r + 1 < lastReportRowNeeded) {
    issues.push({
      message: `Report sheet only covers row ${reportRange.e.r + 1}, but mapping needs row ${lastReportRowNeeded}.`,
      target: `${mapping.reportSheet.name}!A1`
    });
  }

  const groupRange = groupSheet['!ref'] ? XLSX.utils.decode_range(groupSheet['!ref']) : null;
  const lastGroupRowNeeded = XLSX.utils.decode_cell(mapping.groupSheet.comments.address).r + 1;
  if (groupRange && groupRange.e.r + 1 < lastGroupRowNeeded) {
    issues.push({
      message: `Group sheet only covers row ${groupRange.e.r + 1}, but mapping needs row ${lastGroupRowNeeded}.`,
      target: `${mapping.groupSheet.nameTemplate}!A1`
    });
  }

  return { issues, ok: issues.length === 0 };
}
