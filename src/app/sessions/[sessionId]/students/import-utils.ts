import * as XLSX from 'xlsx';
import { z } from 'zod';

const headerAliases: Record<keyof StudentImportRowInput, string[]> = {
  userId: [
    'user id',
    'userid',
    'user_id',
    'id',
    'numero didentification',
    'numero identification',
    'numéro didentification',
    'numéro d identification',
    'identification'
  ],
  firstName: ['first name', 'first_name', 'firstname', 'prenom', 'prénom'],
  lastName: ['last name', 'last_name', 'lastname', 'nom', 'nom de famille'],
  schoolEmail: [
    'school email',
    'school_email',
    'email',
    'e mail',
    'e-mail',
    'mail',
    'adresse de courriel',
    'courriel'
  ]
};

const requiredHeaders = ['firstName', 'lastName', 'schoolEmail'] as const;

const studentImportRowSchema = z.object({
  userId: z.string().trim().optional(),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  schoolEmail: z.string().trim().min(1, 'School email is required').email('School email is invalid')
});

export type StudentImportRowInput = {
  userId: string;
  firstName: string;
  lastName: string;
  schoolEmail: string;
};

export type StudentImportRowError = Partial<
  Record<'firstName' | 'lastName' | 'schoolEmail', string>
>;

export type StudentImportPreviewRow = {
  id: string;
  rowNumber: number;
  values: StudentImportRowInput;
  errors: StudentImportRowError;
  isValid: boolean;
};

export type BoostcampGroupedImportRowInput = {
  firstName: string;
  lastName: string;
  schoolEmail: string;
  groupValue: string;
  detectedClassName: string | null;
  detectedGroupName: string | null;
  confidence: number;
  confidenceLabel: 'high' | 'medium' | 'low';
};

export type BoostcampGroupedImportRowError = Partial<
  Record<'firstName' | 'lastName' | 'schoolEmail', string>
>;

export type BoostcampGroupedImportPreviewRow = {
  id: string;
  rowNumber: number;
  values: BoostcampGroupedImportRowInput;
  errors: BoostcampGroupedImportRowError;
  issues: string[];
  needsResolution: boolean;
  isValid: boolean;
};

export type BoostcampGroupedNormalizationPreviewRow = {
  confidence: number;
  confidenceLabel: 'high' | 'medium' | 'low';
  parsedClassName: string | null;
  parsedGroupName: string | null;
  rawValue: string;
  userCount: number;
};

export type BoostcampGroupedMetadataSuggestions = {
  className: string;
  programme: string;
};

export type BoostcampGroupedImportParseResult =
  | {
      ok: true;
      rows: BoostcampGroupedImportPreviewRow[];
      normalizationPreview: BoostcampGroupedNormalizationPreviewRow[];
      metadataSuggestions: BoostcampGroupedMetadataSuggestions;
      message?: string;
    }
  | {
      ok: false;
      message: string;
      rows: BoostcampGroupedImportPreviewRow[];
      normalizationPreview: BoostcampGroupedNormalizationPreviewRow[];
      metadataSuggestions: BoostcampGroupedMetadataSuggestions;
    };

export type StudentImportParseResult =
  | {
      ok: true;
      rows: StudentImportPreviewRow[];
      message?: string;
    }
  | {
      ok: false;
      message: string;
      rows: StudentImportPreviewRow[];
    };

export const studentImportPayloadSchema = z.object({
  rows: z.array(studentImportRowSchema)
});

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRowValue(value: string) {
  return value.trim();
}

function toCanonicalHeader(value: string) {
  const normalized = normalizeHeader(value);

  for (const [canonical, aliases] of Object.entries(headerAliases)) {
    if (aliases.includes(normalized)) {
      return canonical as keyof StudentImportRowInput;
    }
  }

  return null;
}

function parseDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  if (inQuotes) {
    throw new Error('Malformed text: unmatched quote found.');
  }

  values.push(current);
  return values;
}

function detectDelimiter(line: string) {
  if (line.includes('\t')) {
    return '\t';
  }

  if (line.includes(';') && !line.includes(',')) {
    return ';';
  }

  return ',';
}

function stripBom(text: string) {
  return text.replace(/^\uFEFF/, '');
}

function formatHeaderCells(headers: string[]) {
  return JSON.stringify(headers, null, 2);
}

function rowsFromXlsxSheet(sheet: XLSX.WorkSheet) {
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: ''
  }) as unknown[][];

  return table.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []));
}

function parseBoostcampGroupedTextRows(text: string) {
  const normalizedText = stripBom(text).trim();
  if (!normalizedText) {
    return [];
  }

  const workbook = XLSX.read(normalizedText, { type: 'string' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    return [];
  }

  return rowsFromXlsxSheet(worksheet);
}

async function parseBoostcampGroupedFileRows(file: File) {
  const buffer = await file.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buffer);
  return parseBoostcampGroupedTextRows(text);
}

function parseDelimitedText(text: string) {
  const normalizedText = stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (!normalizedText) {
    return [];
  }

  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => parseDelimitedLine(line, delimiter));
}

function parseCommaDelimitedText(text: string) {
  const normalizedText = stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (!normalizedText) {
    return [];
  }

  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  return lines.map((line) => parseDelimitedLine(line, ','));
}

function parseDelimitedTextWithAutoDelimiter(text: string) {
  const normalizedText = stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (!normalizedText) {
    return {
      delimiter: ',',
      rows: [] as string[][]
    };
  }

  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      delimiter: ',',
      rows: [] as string[][]
    };
  }

  const candidates = [',', ';']
    .map((delimiter) => {
      try {
        const rows = lines.map((line) => parseDelimitedLine(line, delimiter));
        const headerRow = rows[0] ?? [];

        return {
          delimiter,
          headerColumnCount: headerRow.length,
          lineCount: rows.length,
          rows,
          totalCellCount: rows.reduce((sum, row) => sum + row.length, 0)
        };
      } catch {
        return null;
      }
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  if (candidates.length === 0) {
    return {
      delimiter: ',',
      rows: lines.map((line) => parseDelimitedLine(line, ','))
    };
  }

  const bestCandidate = candidates.sort((left, right) => {
    if (right.headerColumnCount !== left.headerColumnCount) {
      return right.headerColumnCount - left.headerColumnCount;
    }

    if (right.totalCellCount !== left.totalCellCount) {
      return right.totalCellCount - left.totalCellCount;
    }

    if (right.lineCount !== left.lineCount) {
      return right.lineCount - left.lineCount;
    }

    return left.delimiter.localeCompare(right.delimiter);
  })[0];

  return {
    delimiter: bestCandidate.delimiter,
    rows: bestCandidate.rows
  };
}

function splitBoostcampName(fullName: string) {
  const normalizedName = fullName.replace(/\s+/g, ' ').trim();
  const exactMatch = normalizedName.match(
    /^(.+?)\s+((?:[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý'’\-]*)(?:\s+[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý'’\-]*)*)$/u
  );

  if (exactMatch) {
    return {
      firstName: exactMatch[1].trim(),
      lastName: exactMatch[2].trim()
    };
  }

  const parts = normalizedName.split(' ');
  if (parts.length <= 1) {
    return {
      firstName: normalizedName,
      lastName: ''
    };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1) ?? ''
  };
}

type GroupTokenAnalysis = {
  classLabel: string | null;
  classScore: number;
  groupLabel: string | null;
  groupScore: number;
  normalized: string;
  raw: string;
  role: 'class' | 'group' | 'ambiguous' | 'unknown';
};

type LabelStats = {
  classPartners: Set<string>;
  classVotes: number;
  count: number;
  groupPartners: Set<string>;
  groupVotes: number;
  display: string;
  patternClassScore: number;
  patternGroupScore: number;
};

function buildConfidenceLabel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.75) {
    return 'high';
  }

  if (confidence >= 0.5) {
    return 'medium';
  }

  return 'low';
}

function normalizeGroupedToken(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function splitGroupedSegments(groupValue: string) {
  return normalizeGroupedToken(groupValue)
    .split(/[;,]+/g)
    .map((segment) => normalizeGroupedToken(segment))
    .filter((segment) => segment.length > 0);
}

function analyzeGroupedToken(token: string): GroupTokenAnalysis {
  const normalized = normalizeGroupedToken(token);
  const wordCount = normalized.length === 0 ? 0 : normalized.split(/\s+/).length;

  let classScore = 0;
  let groupScore = 0;
  let classLabel: string | null = null;
  let groupLabel: string | null = null;

  if (/^m[12]\b/i.test(normalized)) {
    classScore += 5;
    classLabel = normalized;
  }

  if (/\bclasse?\s+\d+/i.test(normalized)) {
    classScore += 4;
    if (!classLabel) {
      classLabel = normalized.replace(/\s*-\s*g\d+\b/iu, '').trim() || normalized;
    }
  }

  if (/\b(?:management|commercial|marketing|communication|digital|business|finance|vente|strat|mngt)\b/i.test(normalized)) {
    classScore += 2;
    if (!classLabel) {
      classLabel = normalized;
    }
  }

  if (wordCount >= 3) {
    classScore += 1;
    if (!classLabel && !/-g\d+\b/i.test(normalized) && !/\bgroupe?\b/i.test(normalized)) {
      classLabel = normalized;
    }
  }

  if (/\bclasse\s+\d+\s*-\s*g\d+\b/i.test(normalized)) {
    groupScore += 6;
    classScore += 1;
    groupLabel = normalized;
    if (!classLabel) {
      classLabel = normalized.replace(/\s*-\s*g\d+\b/iu, '').trim();
    }
  }

  if (/-g\d+\b/i.test(normalized)) {
    groupScore += 5;
    groupLabel = normalized;
  }

  if (/\bgroupe?\s*\d+\b/i.test(normalized)) {
    groupScore += 4;
    if (!groupLabel) {
      groupLabel = normalized;
    }
  }

  if (/^g\d+\b/i.test(normalized) || /\bg\d+\b/i.test(normalized)) {
    groupScore += 3;
    if (!groupLabel) {
      groupLabel = normalized;
    }
  }

  if (/\bclasse\s*\d+\b/i.test(normalized) && !/-g\d+\b/i.test(normalized)) {
    classScore += 3;
    if (!classLabel) {
      classLabel = normalized;
    }
  }

  const role =
    classScore > groupScore
      ? 'class'
      : groupScore > classScore
        ? 'group'
        : classScore > 0 || groupScore > 0
          ? 'ambiguous'
          : 'unknown';

  return {
    classLabel,
    classScore,
    groupLabel,
    groupScore,
    normalized,
    raw: token,
    role
  };
}

function buildGroupedTokenStats(rows: Array<{ tokens: GroupTokenAnalysis[] }>) {
  const stats = new Map<string, LabelStats>();

  function getStat(label: string) {
    const existing = stats.get(label);
    if (existing) {
      return existing;
    }

    const created: LabelStats = {
      classPartners: new Set<string>(),
      classVotes: 0,
      count: 0,
      groupPartners: new Set<string>(),
      groupVotes: 0,
      display: label,
      patternClassScore: 0,
      patternGroupScore: 0
    };
    stats.set(label, created);
    return created;
  }

  for (const row of rows) {
    const classLabels = row.tokens
      .map((token) => token.classLabel)
      .filter((label): label is string => Boolean(label));
    const groupLabels = row.tokens
      .map((token) => token.groupLabel)
      .filter((label): label is string => Boolean(label));

    for (const token of row.tokens) {
      if (token.classLabel) {
        const stat = getStat(token.classLabel);
        stat.count += 1;
        stat.classVotes += token.classScore;
        stat.patternClassScore = Math.max(stat.patternClassScore, token.classScore);
        for (const groupLabel of groupLabels) {
          stat.groupPartners.add(groupLabel);
        }
      }

      if (token.groupLabel) {
        const stat = getStat(token.groupLabel);
        stat.count += 1;
        stat.groupVotes += token.groupScore;
        stat.patternGroupScore = Math.max(stat.patternGroupScore, token.groupScore);
        for (const classLabel of classLabels) {
          stat.classPartners.add(classLabel);
        }
      }
    }
  }

  return stats;
}

function scoreLabelForRole(label: string, stats: Map<string, LabelStats>, role: 'class' | 'group') {
  const stat = stats.get(label);
  if (!stat) {
    return 0;
  }

  if (role === 'class') {
    return (
      stat.patternClassScore * 3 +
      Math.log(stat.count + 1) * 2 +
      Math.log(stat.groupPartners.size + 1) * 2 +
      stat.classVotes * 0.25
    );
  }

  return (
    stat.patternGroupScore * 3 +
      (1 / (stat.count + 1)) * 6 +
      (1 / (stat.classPartners.size + 1)) * 4 +
      stat.groupVotes * 0.25
  );
}

function parseGroupedAssignments(groupValue: string, tokenStats?: Map<string, LabelStats>) {
  const tokens = splitGroupedSegments(groupValue).map(analyzeGroupedToken);
  const stats = tokenStats ?? new Map<string, LabelStats>();

  const classCandidates = tokens
    .map((token) => {
      const classLabel = token.classLabel;
      if (!classLabel) {
        if (token.role === 'unknown' && token.normalized) {
          const classSupport = scoreLabelForRole(token.normalized, stats, 'class');
          const groupSupport = scoreLabelForRole(token.normalized, stats, 'group');

          if (classSupport <= groupSupport + 1.25) {
            return null;
          }

          return {
            label: token.normalized,
            score: classSupport,
            token
          };
        }

        return null;
      }

      const support = scoreLabelForRole(classLabel, stats, 'class') + token.classScore;
      return {
        label: classLabel,
        score: support,
        token
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const groupCandidates = tokens
    .map((token) => {
      const groupLabel = token.groupLabel;
      if (!groupLabel) {
        if (token.role === 'unknown' && token.normalized) {
          const groupSupport = scoreLabelForRole(token.normalized, stats, 'group');
          const classSupport = scoreLabelForRole(token.normalized, stats, 'class');

          if (groupSupport <= classSupport + 1.25) {
            return null;
          }

          return {
            label: token.normalized,
            score: groupSupport,
            token
          };
        }

        return null;
      }

      const support = scoreLabelForRole(groupLabel, stats, 'group') + token.groupScore;
      return {
        label: groupLabel,
        score: support,
        token
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const bestClass = classCandidates.sort((left, right) => right.score - left.score)[0] ?? null;
  const bestGroup = groupCandidates.sort((left, right) => right.score - left.score)[0] ?? null;

  let className = bestClass?.label ?? null;
  let groupName = bestGroup?.label ?? null;
  let confidence = 0;

  if (bestClass && bestGroup) {
    const bestGroupHasExplicitClass = Boolean(bestGroup.token.classLabel);
    const bestClassHasExplicitGroup = Boolean(bestClass.token.groupLabel);

    if (bestGroup.score > bestClass.score + 1.25 && bestGroupHasExplicitClass) {
      className = bestGroup.token.classLabel ?? bestClass.label;
      groupName = bestGroup.token.groupLabel ?? bestGroup.label;
    } else if (bestClass.score > bestGroup.score + 1.25 && bestClassHasExplicitGroup) {
      className = bestClass.token.classLabel ?? bestClass.label;
      groupName = bestClass.token.groupLabel ?? bestGroup.label;
    }

    const combinedScore = bestClass.score + bestGroup.score;
    confidence = Math.min(0.95, 0.58 + combinedScore / 40);
  } else if (bestClass) {
    confidence = Math.min(0.92, 0.66 + bestClass.score / 24);
  } else if (bestGroup) {
    confidence = Math.min(0.72, 0.46 + bestGroup.score / 24);
  }

  if (!className && bestGroup?.token.classLabel) {
    className = bestGroup.token.classLabel;
  }

  if (!groupName && bestClass?.token.groupLabel) {
    groupName = bestClass.token.groupLabel;
  }

  const confidenceLabel = buildConfidenceLabel(confidence);

  const needsResolution = !className;

  return {
    className,
    confidence,
    confidenceLabel,
    groupName,
    needsResolution,
    rawValue: groupValue,
    tokens
  };
}

function validateRows(
  rows: Array<{ id: string; rowNumber: number; values: StudentImportRowInput }>,
  existingEmails: string[]
) {
  const normalizedExistingEmails = new Set(
    existingEmails.map((email) => email.trim().toLowerCase())
  );
  const emailCounts = new Map<string, number>();

  for (const row of rows) {
    const normalizedEmail = row.values.schoolEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      continue;
    }

    emailCounts.set(normalizedEmail, (emailCounts.get(normalizedEmail) ?? 0) + 1);
  }

  return rows.map((row) => {
    const normalizedValues: StudentImportRowInput = {
      userId: normalizeRowValue(row.values.userId),
      firstName: normalizeRowValue(row.values.firstName),
      lastName: normalizeRowValue(row.values.lastName),
      schoolEmail: normalizeRowValue(row.values.schoolEmail).toLowerCase()
    };

    const errors: StudentImportRowError = {};
    const parsed = studentImportRowSchema.safeParse(normalizedValues);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;

      if (fieldErrors.firstName?.[0]) {
        errors.firstName = fieldErrors.firstName[0];
      }

      if (fieldErrors.lastName?.[0]) {
        errors.lastName = fieldErrors.lastName[0];
      }

      if (fieldErrors.schoolEmail?.[0]) {
        errors.schoolEmail = fieldErrors.schoolEmail[0];
      }
    }

    if (
      normalizedValues.schoolEmail &&
      (emailCounts.get(normalizedValues.schoolEmail) ?? 0) > 1
    ) {
      errors.schoolEmail = 'Duplicate email in this file';
    } else if (normalizedExistingEmails.has(normalizedValues.schoolEmail)) {
      errors.schoolEmail = 'Email already exists in this session';
    }

    return {
      id: row.id,
      rowNumber: row.rowNumber,
      values: normalizedValues,
      errors,
      isValid: Object.keys(errors).length === 0
    };
  });
}

function buildResult(
  rows: Array<{ id: string; rowNumber: number; values: StudentImportRowInput }>,
  existingEmails: string[],
  successMessage: string
): StudentImportParseResult {
  const previewRows = validateRows(rows, existingEmails);

  return {
    ok: true,
    rows: previewRows,
    message: previewRows.every((row) => row.isValid)
      ? successMessage
      : 'Review the highlighted rows before importing.'
  };
}

function parseStudentTableRows(
  rows: string[][],
  existingEmails: string[],
  successMessage: string
): StudentImportParseResult {
  if (rows.length === 0) {
    return {
      ok: false,
      message: 'The uploaded file is empty.',
      rows: []
    };
  }

  const [headerRow, ...dataRows] = rows;
  const headerMap = headerRow.map(toCanonicalHeader);
  const missingHeaders = requiredHeaders.filter((header) => !headerMap.includes(header));

  if (missingHeaders.length > 0) {
    return {
      ok: false,
      message:
        'Missing required headers. Expected first name, last name, and school email columns.',
      rows: []
    };
  }

  const normalizedRows = dataRows
    .map((columns, rowIndex) => {
      const values: StudentImportRowInput = {
        userId: '',
        firstName: '',
        lastName: '',
        schoolEmail: ''
      };

      headerMap.forEach((header, columnIndex) => {
        if (!header) {
          return;
        }

        values[header] = columns[columnIndex] ?? '';
      });

      return {
        id: `row-${rowIndex + 1}`,
        rowNumber: rowIndex + 2,
        values
      };
    })
    .filter((row) =>
      Object.values(row.values).some((value) => value.trim().length > 0)
    );

  if (normalizedRows.length === 0) {
    return {
      ok: false,
      message: 'The uploaded file has headers but no student rows.',
      rows: []
    };
  }

  return buildResult(normalizedRows, existingEmails, successMessage);
}

function parseBoostcampGroupedTableRows(rows: string[][]): BoostcampGroupedImportParseResult {
  const headerAliases: Record<'firstName' | 'lastName' | 'schoolEmail' | 'groupValue', string[]> = {
    firstName: ['first name', 'first_name', 'firstname', 'prenom', 'prénom'],
    lastName: ['last name', 'last_name', 'lastname', 'nom', 'nom de famille'],
    schoolEmail: [
      'school email',
      'school_email',
      'email',
      'e mail',
      'e-mail',
      'mail',
      'adresse de courriel',
      'courriel'
    ],
    groupValue: ['groupes', 'groupe', 'groups', 'class', 'classe']
  };

  const emptyResult = {
    className: '',
    programme: ''
  };

  const requiredHeaders = ['firstName', 'lastName', 'schoolEmail', 'groupValue'] as const;

  if (rows.length === 0) {
    return {
      ok: false,
      message: 'The uploaded CSV is empty.',
      rows: [],
      normalizationPreview: [],
      metadataSuggestions: emptyResult
    };
  }

  const [headerRow, ...dataRows] = rows;
  const normalizedHeaders = headerRow.map((header) => normalizeHeader(header));
  const headerMap = headerRow.map((header) => {
    const normalized = normalizeHeader(header);

    for (const [canonical, aliases] of Object.entries(headerAliases)) {
      if (aliases.includes(normalized)) {
        return canonical as keyof typeof headerAliases;
      }
    }

    return null;
  });

  const missingHeaders = requiredHeaders.filter((header) => !headerMap.includes(header));

  if (missingHeaders.length > 0) {
    return {
      ok: false,
      message: [
        'Missing required headers. Expected first name, last name, school email, and groups columns.',
        `Detected header cells: ${formatHeaderCells(headerRow)}`,
        `Normalized header cells: ${formatHeaderCells(normalizedHeaders)}`
      ].join(' '),
      rows: [],
      normalizationPreview: [],
      metadataSuggestions: emptyResult
    };
  }

  const candidateRows = dataRows
    .map((columns, rowIndex) => {
      const firstNameColumn = headerMap.indexOf('firstName');
      const lastNameColumn = headerMap.indexOf('lastName');
      const schoolEmailColumn = headerMap.indexOf('schoolEmail');
      const groupValueColumn = headerMap.indexOf('groupValue');

      const values: BoostcampGroupedImportRowInput = {
        firstName: firstNameColumn >= 0 ? columns[firstNameColumn] ?? '' : '',
        lastName: lastNameColumn >= 0 ? columns[lastNameColumn] ?? '' : '',
        schoolEmail: schoolEmailColumn >= 0 ? columns[schoolEmailColumn] ?? '' : '',
        groupValue: groupValueColumn >= 0 ? columns[groupValueColumn] ?? '' : '',
        detectedClassName: null,
        detectedGroupName: null,
        confidence: 0,
        confidenceLabel: 'low'
      };

      return {
        id: `row-${rowIndex + 1}`,
        rawValue: values.groupValue,
        rowNumber: rowIndex + 2,
        tokens: splitGroupedSegments(values.groupValue).map(analyzeGroupedToken),
        values
      };
    })
    .filter((row) =>
      Object.values(row.values).some((value) => String(value ?? '').trim().length > 0)
    );

  if (candidateRows.length === 0) {
    return {
      ok: false,
      message: 'The uploaded CSV has headers but no student rows.',
      rows: [],
      normalizationPreview: [],
      metadataSuggestions: emptyResult
    };
  }

  const tokenStats = buildGroupedTokenStats(candidateRows);
  const emailCounts = new Map<string, number>();
  for (const row of candidateRows) {
    const normalizedEmail = row.values.schoolEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      continue;
    }

    emailCounts.set(normalizedEmail, (emailCounts.get(normalizedEmail) ?? 0) + 1);
  }

  const previewRows = candidateRows.map((row) => {
    const parsed = parseGroupedAssignments(row.rawValue, tokenStats);
    const normalizedValues: BoostcampGroupedImportRowInput = {
      firstName: normalizeRowValue(row.values.firstName),
      lastName: normalizeRowValue(row.values.lastName),
      schoolEmail: normalizeRowValue(row.values.schoolEmail).toLowerCase(),
      groupValue: normalizeRowValue(row.values.groupValue),
      detectedClassName: parsed.className?.trim() || null,
      detectedGroupName: parsed.groupName?.trim() || null,
      confidence: parsed.confidence,
      confidenceLabel: parsed.confidenceLabel
    };

    const errors: BoostcampGroupedImportRowError = {};
    const studentParsed = studentImportRowSchema.safeParse({
      firstName: normalizedValues.firstName,
      lastName: normalizedValues.lastName,
      schoolEmail: normalizedValues.schoolEmail,
      userId: ''
    });

    if (!studentParsed.success) {
      const fieldErrors = studentParsed.error.flatten().fieldErrors;

      if (fieldErrors.firstName?.[0]) {
        errors.firstName = fieldErrors.firstName[0];
      }

      if (fieldErrors.lastName?.[0]) {
        errors.lastName = fieldErrors.lastName[0];
      }

      if (fieldErrors.schoolEmail?.[0]) {
        errors.schoolEmail = fieldErrors.schoolEmail[0];
      }
    }

    if (normalizedValues.schoolEmail && (emailCounts.get(normalizedValues.schoolEmail) ?? 0) > 1) {
      errors.schoolEmail = 'Duplicate email in this file';
    }

    const issues: string[] = [];
    if (!normalizedValues.detectedClassName) {
      issues.push('no class detected');
      if (!normalizedValues.detectedGroupName) {
        issues.push('no group detected');
      }
    }

    return {
      id: row.id,
      rowNumber: row.rowNumber,
      values: normalizedValues,
      errors,
      issues,
      needsResolution: issues.length > 0,
      isValid: Object.keys(errors).length === 0 && issues.length === 0
    };
  });

  const normalizationPreviewMap = new Map<
    string,
    {
      classCounts: Map<string, number>;
      confidenceTotal: number;
      count: number;
      groupCounts: Map<string, number>;
    }
  >();

  for (const row of previewRows) {
    const rawValue = row.values.groupValue.trim();
    const entry = normalizationPreviewMap.get(rawValue) ?? {
      classCounts: new Map<string, number>(),
      confidenceTotal: 0,
      count: 0,
      groupCounts: new Map<string, number>()
    };

    entry.count += 1;
    entry.confidenceTotal += row.values.confidence;

    if (row.values.detectedClassName) {
      entry.classCounts.set(
        row.values.detectedClassName,
        (entry.classCounts.get(row.values.detectedClassName) ?? 0) + 1
      );
    }

    if (row.values.detectedGroupName) {
      entry.groupCounts.set(
        row.values.detectedGroupName,
        (entry.groupCounts.get(row.values.detectedGroupName) ?? 0) + 1
      );
    }

    normalizationPreviewMap.set(rawValue, entry);
  }

  function pickMostCommon(values: Map<string, number>) {
    const entries = [...values.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], 'en', { sensitivity: 'base' });
    });

    return entries[0]?.[0] ?? null;
  }

  const normalizationPreview = [...normalizationPreviewMap.entries()]
    .map(([rawValue, entry]) => {
      const confidence = entry.count > 0 ? entry.confidenceTotal / entry.count : 0;
      return {
        confidence,
        confidenceLabel: buildConfidenceLabel(confidence),
        parsedClassName: pickMostCommon(entry.classCounts),
        parsedGroupName: pickMostCommon(entry.groupCounts),
        rawValue,
        userCount: entry.count
      };
    })
    .sort((left, right) => left.rawValue.localeCompare(right.rawValue, 'en', { sensitivity: 'base' }));

  const classCandidates = new Map<string, number>();
  const programmeCandidates = new Map<string, number>();

  for (const row of previewRows) {
    const className = row.values.detectedClassName?.trim() ?? '';
    if (!className) {
      continue;
    }

    if (
      /^m[12]\b/i.test(className) ||
      /\b(?:management|commercial|marketing|communication|digital|business|finance|vente|strat|mngt)\b/i.test(className)
    ) {
      programmeCandidates.set(className, (programmeCandidates.get(className) ?? 0) + 1);
    }

    if (/^classe\s+\d+/i.test(className) || /^class\s+\d+/i.test(className)) {
      classCandidates.set(className, (classCandidates.get(className) ?? 0) + 1);
    }
  }

  function pickSuggestion(candidates: Map<string, number>) {
    const entries = [...candidates.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], 'en', { sensitivity: 'base' });
    });

    if (entries.length === 0) {
      return '';
    }

    const [topLabel, topCount] = entries[0];
    const secondCount = entries[1]?.[1] ?? 0;
    const totalCount = entries.reduce((sum, entry) => sum + entry[1], 0);

    if (topCount / Math.max(totalCount, 1) < 0.6) {
      return '';
    }

    if (secondCount > 0 && topCount < secondCount * 1.2) {
      return '';
    }

    return topLabel;
  }

  const metadataSuggestions = {
    className: pickSuggestion(classCandidates),
    programme: pickSuggestion(programmeCandidates)
  };

  return {
    ok: true,
    rows: previewRows,
    normalizationPreview,
    metadataSuggestions,
    message: previewRows.every((row) => row.isValid)
      ? 'Grouped CSV parsed successfully. Ready to review.'
      : 'Review the highlighted rows before continuing.'
  };
}

function parseBoostcampRosterText(
  text: string,
  existingEmails: string[],
  successMessage: string
): StudentImportParseResult | null {
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalizedText) {
    return {
      ok: false,
      message: 'The pasted text is empty.',
      rows: []
    };
  }

  const entryRegex =
    /([^()\r\n]+?)\s*\(\s*(\d+)\s*,\s*([^\s(),]+@[^\s(),]+)\s*\)/gu;
  const matches = [...normalizedText.matchAll(entryRegex)];

  if (matches.length === 0) {
    return null;
  }

  const rows = matches.map((match, index) => {
    const fullName = match[1].trim();
    const { firstName, lastName } = splitBoostcampName(fullName);

    return {
      id: `row-${index + 1}`,
      rowNumber: index + 1,
      values: {
        userId: match[2].trim(),
        firstName,
        lastName,
        schoolEmail: match[3].trim()
      }
    };
  });

  return buildResult(rows, existingEmails, successMessage);
}

export function revalidateStudentImportRows(
  rows: Array<{ id: string; rowNumber: number; values: StudentImportRowInput }>,
  existingEmails: string[]
) {
  return validateRows(rows, existingEmails);
}

export async function parseStudentImportFile(
  file: File,
  existingEmails: string[]
): Promise<StudentImportParseResult> {
  const fileName = file.name.toLowerCase();
  const looksLikeSpreadsheet =
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xlsm') ||
    file.type.includes('spreadsheetml') ||
    file.type.includes('excel');

  if (looksLikeSpreadsheet) {
    try {
      const xlsx = await import('xlsx');
      const workbook = xlsx.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        return {
          ok: false,
          message: 'The spreadsheet does not contain any sheets.',
          rows: []
        };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const table = xlsx.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        blankrows: false,
        defval: ''
      }) as unknown[][];

      const rows = table.map((row) =>
        Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []
      );

      return parseStudentTableRows(
        rows,
        existingEmails,
        'Spreadsheet parsed successfully. Ready to import.'
      );
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to read the spreadsheet file.',
        rows: []
      };
    }
  }

  return parseStudentImportText(await file.text(), existingEmails);
}

export function parseStudentImportText(
  text: string,
  existingEmails: string[]
): StudentImportParseResult {
  const boostcampResult = parseBoostcampRosterText(
    text,
    existingEmails,
    'Roster text parsed successfully. Ready to import.'
  );

  if (boostcampResult) {
    return boostcampResult;
  }

  let parsedRows: string[][];

  try {
    parsedRows = parseDelimitedText(text);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to parse the pasted text.',
      rows: []
    };
  }

  return parseStudentTableRows(
    parsedRows,
    existingEmails,
    'Text parsed successfully. Ready to import.'
  );
}

export function parseStudentCsv(csvText: string, existingEmails: string[]) {
  return parseStudentImportText(csvText, existingEmails);
}

export function parseBoostcampGroupedCsv(csvText: string): BoostcampGroupedImportParseResult {
  const parsedRows = parseBoostcampGroupedTextRows(csvText);

  if (parsedRows.length === 0) {
    return {
      ok: false,
      message: 'The uploaded CSV is empty.',
      metadataSuggestions: {
        className: '',
        programme: ''
      },
      normalizationPreview: [],
      rows: []
    };
  }

  return parseBoostcampGroupedTableRows(parsedRows);
}

export async function parseBoostcampGroupedFile(
  file: File
): Promise<BoostcampGroupedImportParseResult> {
  try {
    const parsedRows = await parseBoostcampGroupedFileRows(file);

    if (parsedRows.length === 0) {
      return {
        ok: false,
        message: 'The uploaded CSV is empty.',
        metadataSuggestions: {
          className: '',
          programme: ''
        },
        normalizationPreview: [],
        rows: []
      };
    }

    return parseBoostcampGroupedTableRows(parsedRows);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to read the uploaded CSV file.',
      metadataSuggestions: {
        className: '',
        programme: ''
      },
      normalizationPreview: [],
      rows: []
    };
  }
}
