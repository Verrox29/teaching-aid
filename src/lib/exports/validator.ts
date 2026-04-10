import * as XLSX from 'xlsx';

import type {
  ExportValidationIssue,
  ExportValidationResult,
  PairagogieExportMapping
} from './types';

function hasMergedRange(sheet: XLSX.WorkSheet, range: string) {
  const merges = sheet['!merges'] ?? [];
  return merges.some((merge) => {
    const encoded = `${XLSX.utils.encode_cell(merge.s)}:${XLSX.utils.encode_cell(merge.e)}`;
    return encoded === range;
  });
}

function cellExists(sheet: XLSX.WorkSheet, address: string) {
  return Boolean(sheet[address]);
}

function formulaExists(sheet: XLSX.WorkSheet, address: string) {
  const cell = sheet[address] as XLSX.CellObject | undefined;
  return Boolean(cell?.f);
}

export function validatePairagogieTemplateBuffer(
  buffer: Buffer,
  mapping: PairagogieExportMapping
): ExportValidationResult {
  const workbook = XLSX.read(buffer, { cellFormula: true, cellStyles: true });
  const issues: ExportValidationIssue[] = [];
  const sheet = workbook.Sheets[mapping.sheetName];

  if (!sheet) {
    issues.push({
      message: `Missing required sheet "${mapping.sheetName}".`,
      target: mapping.sheetName
    });
    return { issues, ok: false };
  }

  for (const [semanticKey, address] of Object.entries(mapping.cells)) {
    if (!cellExists(sheet, address)) {
      issues.push({
        message: `Missing required cell for ${semanticKey}.`,
        target: `${mapping.sheetName}!${address}`
      });
    }
  }

  for (const range of mapping.expectedMergedRanges) {
    if (!hasMergedRange(sheet, range)) {
      issues.push({
        message: `Missing required merged range ${range}.`,
        target: `${mapping.sheetName}!${range}`
      });
    }
  }

  for (const address of mapping.expectedFormulaCells) {
    if (!formulaExists(sheet, address)) {
      issues.push({
        message: `Missing required formula cell at ${address}.`,
        target: `${mapping.sheetName}!${address}`
      });
    }
  }

  const criteriaEndRow = mapping.rubric.startRow + mapping.rubric.maxRows - 1;
  const expectedTableRows = criteriaEndRow + 10;
  const ref = sheet['!ref'];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    if (range.e.r + 1 < expectedTableRows) {
      issues.push({
        message: `Template only covers row ${range.e.r + 1}, but export needs at least row ${expectedTableRows}.`,
        target: `${mapping.sheetName}!A1`
      });
    }
  }

  return { issues, ok: issues.length === 0 };
}
