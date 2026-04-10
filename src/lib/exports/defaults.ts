import path from 'node:path';

import type { PairagogieExportMapping } from './types';

export const EXPORT_SETTINGS_KEY = 'global';
export const DEFAULT_EXPORT_TEMPLATE_VERSION = 'v1';
export const DEFAULT_EXPORT_MAPPING_VERSION = 'v2';

export const DEFAULT_PAIRAGOGIE_MAPPING: PairagogieExportMapping = {
  version: DEFAULT_EXPORT_MAPPING_VERSION,
  templateVersion: DEFAULT_EXPORT_TEMPLATE_VERSION,
  reportSheet: {
    name: 'REPORT des notes par étudiant',
    header: {
      professorName: {
        address: 'C2',
        kind: 'mergedCell',
        range: 'C2:D2'
      },
      sessionDate: {
        address: 'F2',
        kind: 'cell'
      },
      subjectProgramme: {
        address: 'C3',
        kind: 'mergedCell',
        range: 'C3:D3'
      },
      className: {
        address: 'E3',
        kind: 'cell'
      },
      season: {
        address: 'F3',
        kind: 'cell'
      }
    },
    studentRows: {
      columns: {
        firstName: 'B',
        lastName: 'C',
        groupName: 'D',
        totalScore: 'E',
        remarks: 'F'
      },
      kind: 'tableRows',
      maxRows: 954,
      startRow: 5
    },
    expectedLabels: [
      { address: 'B1', value: 'MERCI DE REPORTER TOUTES LES NOTES DE CHAQUE ETUDIANT SUR CE FICHIER' },
      { address: 'B2', value: 'INTERVENANT ( Prénom, Nom):' },
      { address: 'E2', value: 'DATE soutenance:' },
      { address: 'B3', value: 'Intitulé COURS et Programme :' },
      { address: 'B4', value: 'Prénom étudiant' },
      { address: 'C4', value: 'Nom Etudiant' },
      { address: 'D4', value: 'Numéro de groupe' },
      { address: 'E4', value: 'Note /20' },
      { address: 'F4', value: 'remarques' }
    ]
  },
  groupSheet: {
    nameTemplate: 'Fiche éval group 1',
    titleLine: {
      address: 'B6',
      kind: 'cell'
    },
    sessionFields: {
      programme: {
        address: 'B2',
        kind: 'mergedCell',
        range: 'B2:E2'
      },
      className: {
        address: 'B3',
        kind: 'mergedCell',
        range: 'B3:E3'
      },
      subject: {
        address: 'B4',
        kind: 'mergedCell',
        range: 'B4:E4'
      }
    },
    studentNames: {
      column: 'B',
      kind: 'verticalRange',
      maxRows: 10,
      startRow: 7
    },
    rubricBlocks: {
      block1: {
        criteriaCount: 4,
        maxScoreColumn: 'D',
        scoreColumn: 'C',
        sectionTitle: {
          address: 'B18',
          kind: 'cell'
        },
        startRow: 19,
        subtotalCell: {
          address: 'D23',
          formula: 'SUM(C19:C22)'
        },
        totalOutOfCell: {
          address: 'E23',
          kind: 'cell'
        }
      },
      block2: {
        criteriaCount: 8,
        maxScoreColumn: 'D',
        scoreColumn: 'C',
        sectionTitle: {
          address: 'B24',
          kind: 'cell'
        },
        startRow: 25,
        subtotalCell: {
          address: 'D33',
          formula: 'SUM(C25:C32)'
        },
        totalOutOfCell: {
          address: 'E33',
          kind: 'cell'
        }
      }
    },
    finalScoreCell: {
      address: 'D35',
      formula: 'SUM(C19:C32)'
    },
    comments: {
      address: 'B38',
      kind: 'mergedCell',
      range: 'B38:E38'
    },
    expectedLabels: [
      { address: 'B1', value: 'EVALUATION  COMPETENCES (PAIRAGOGIE)' },
      { address: 'B6', value: 'GROUPE 1 - liste des étudiants (Prénom-Nom)' },
      { address: 'C6', value: 'Présence (OUI/NON)' },
      { address: 'B18', value: '1 - Support de présentation' },
      { address: 'B24', value: '2- Soutenance orale, réponse aux questions & évaluation par les pairs' },
      { address: 'B37', value: 'COMMENTAIRES (OBLIGATOIRES pour feed back étudiants)' },
      { address: 'E23', value: '/7' },
      { address: 'E33', value: '/13' },
      { address: 'E35', value: '/20' }
    ]
  }
};

export const DEFAULT_PAIRAGOGIE_TEMPLATE_PATH = path.join(
  process.cwd(),
  'templates',
  'grille-pairagogie.xlsx'
);
