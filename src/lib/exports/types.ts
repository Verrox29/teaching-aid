export type PairagogieCellSelector = {
  address: string;
  kind: 'cell';
};

export type PairagogieMergedCellSelector = {
  address: string;
  kind: 'mergedCell';
  range: string;
};

export type PairagogieVerticalRangeSelector = {
  column: string;
  kind: 'verticalRange';
  maxRows: number;
  startRow: number;
};

export type PairagogieTableRowsSelector = {
  columns: {
    firstName: string;
    groupName: string;
    lastName: string;
    remarks: string;
    totalScore: string;
  };
  kind: 'tableRows';
  maxRows: number;
  startRow: number;
};

export type PairagogieExpectedLabel = {
  address: string;
  value: string;
};

export type PairagogieFormulaCell = {
  address: string;
  formula: string;
};

export type PairagogieRubricBlockMapping = {
  criteriaCount: number;
  maxScoreColumn: string;
  scoreColumn: string;
  sectionTitle: PairagogieCellSelector;
  startRow: number;
  subtotalCell: PairagogieFormulaCell;
  totalOutOfCell: PairagogieCellSelector;
};

export type PairagogieReportSheetMapping = {
  expectedLabels: PairagogieExpectedLabel[];
  header: {
    className: PairagogieCellSelector;
    professorName: PairagogieMergedCellSelector;
    season: PairagogieCellSelector;
    sessionDate: PairagogieCellSelector;
    subjectProgramme: PairagogieMergedCellSelector;
  };
  name: string;
  studentRows: PairagogieTableRowsSelector;
};

export type PairagogieGroupSheetMapping = {
  comments: PairagogieMergedCellSelector;
  expectedLabels: PairagogieExpectedLabel[];
  finalScoreCell: PairagogieFormulaCell;
  nameTemplate: string;
  rubricBlocks: {
    block1: PairagogieRubricBlockMapping;
    block2: PairagogieRubricBlockMapping;
  };
  sessionFields: {
    className: PairagogieMergedCellSelector;
    programme: PairagogieMergedCellSelector;
    subject: PairagogieMergedCellSelector;
  };
  studentNames: PairagogieVerticalRangeSelector;
  titleLine: PairagogieCellSelector;
};

export type PairagogieExportMapping = {
  groupSheet: PairagogieGroupSheetMapping;
  reportSheet: PairagogieReportSheetMapping;
  templateVersion: string;
  version: string;
};

export type ExportValidationIssue = {
  message: string;
  target: string;
};

export type ExportValidationResult = {
  issues: ExportValidationIssue[];
  ok: boolean;
};

export type SessionExportMetadata = {
  className: string;
  professorName: string;
  programme: string;
  season: string;
  sessionDate: string;
  subject: string;
};

export type ExportTemplateVersionRecord = {
  contentBase64: string;
  checksum: string;
  fileName: string;
  isActive: boolean;
  updatedAt?: Date;
  version: string;
};

export type ExportMappingVersionRecord = {
  isActive: boolean;
  mappingJson: PairagogieExportMapping;
  templateVersion: string;
  updatedAt?: Date;
  version: string;
};
