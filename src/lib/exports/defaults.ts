import path from 'node:path';

import type { PairagogieExportMapping } from './types';

export const EXPORT_SETTINGS_KEY = 'global';
export const DEFAULT_EXPORT_TEMPLATE_VERSION = 'v1';
export const DEFAULT_EXPORT_MAPPING_VERSION = 'v1';

export const DEFAULT_PAIRAGOGIE_MAPPING: PairagogieExportMapping = {
  version: DEFAULT_EXPORT_MAPPING_VERSION,
  sheetName: 'Pairagogie',
  cells: {
    'session.programme': 'B3',
    'session.className': 'E3',
    'session.subject': 'B4',
    'session.season': 'E4',
    'session.professorName': 'B5',
    'session.sessionDate': 'E5',
    'group.name': 'B7',
    'group.presentationOrder': 'E7',
    'group.submissionTitle': 'B8',
    'group.memberCount': 'E8',
    'group.members': 'B9',
    'rubric.totalScore': 'C32',
    'rubric.teacherNotes': 'B35',
    'rubric.finalFeedback': 'B36',
    'rubric.challengeQuestions': 'B39'
  },
  rubric: {
    startRow: 11,
    maxRows: 20,
    columns: {
      label: 'A',
      maxScore: 'B',
      score: 'C',
      feedback: 'D',
      aiDraft: 'E'
    }
  },
  expectedFormulaCells: ['C32'],
  expectedMergedRanges: ['A1:F1', 'B3:C3', 'E3:F3', 'B4:C4', 'E4:F4', 'B5:C5', 'E5:F5', 'B7:C7', 'E7:F7', 'B8:C8', 'E8:F8', 'B9:F9', 'B35:F35', 'B36:F37', 'B39:F41']
};

export const DEFAULT_PAIRAGOGIE_TEMPLATE_PATH = path.join(
  process.cwd(),
  'templates',
  'grille-pairagogie.xlsx'
);
