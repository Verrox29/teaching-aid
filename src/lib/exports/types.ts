export type PairagogieCellMap = {
  'session.programme': string;
  'session.className': string;
  'session.subject': string;
  'session.season': string;
  'session.professorName': string;
  'session.sessionDate': string;
  'group.name': string;
  'group.presentationOrder': string;
  'group.submissionTitle': string;
  'group.memberCount': string;
  'group.members': string;
  'rubric.totalScore': string;
  'rubric.teacherNotes': string;
  'rubric.finalFeedback': string;
  'rubric.challengeQuestions': string;
};

export type PairagogieRubricTable = {
  columns: {
    aiDraft: string;
    feedback: string;
    label: string;
    maxScore: string;
    score: string;
  };
  maxRows: number;
  startRow: number;
};

export type PairagogieExportMapping = {
  cells: PairagogieCellMap;
  expectedFormulaCells: string[];
  expectedMergedRanges: string[];
  rubric: PairagogieRubricTable;
  sheetName: string;
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
