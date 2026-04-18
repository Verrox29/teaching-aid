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

export type BoostcampGroupedImportParseResult =
  | {
      ok: true;
      rows: BoostcampGroupedImportPreviewRow[];
      message?: string;
    }
  | {
      ok: false;
      message: string;
      rows: BoostcampGroupedImportPreviewRow[];
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

function parseDelimitedText(text: string) {
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

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
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

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

function splitBoostcampGroupValue(groupValue: string) {
  const normalizedValue = groupValue.replace(/\s+/g, ' ').trim();

  if (!normalizedValue) {
    return {
      detectedClassName: null,
      detectedGroupName: null
    };
  }

  const classKeywordMatch = normalizedValue.match(
    /^(.*?)\b(?:class(?:e)?|classe)\b\s*[:\-]?\s*(.*?)\b(?:group(?:e)?|groupe)\b\s*[:\-]?\s*(.*?)$/iu
  );
  if (classKeywordMatch) {
    return {
      detectedClassName: classKeywordMatch[1].trim() || classKeywordMatch[2].trim() || null,
      detectedGroupName: classKeywordMatch[3].trim() || null
    };
  }

  const groupKeywordMatch = normalizedValue.match(
    /^(.*?)\b(?:group(?:e)?|groupe)\b\s*[:\-]?\s*(.*?)$/iu
  );
  if (groupKeywordMatch) {
    const prefix = groupKeywordMatch[1].trim();
    const suffix = groupKeywordMatch[2].trim();
    if (prefix && suffix) {
      return {
        detectedClassName: prefix,
        detectedGroupName: suffix
      };
    }
  }

  const separators = [' / ', ' - ', ' – ', ' — ', ' | ', ' > ', ' : ', ' · ', ' • '];
  for (const separator of separators) {
    if (!normalizedValue.includes(separator)) {
      continue;
    }

    const [className, ...groupParts] = normalizedValue.split(separator);
    const detectedClassName = className?.trim() || null;
    const detectedGroupName = groupParts.join(separator).trim() || null;

    if (detectedClassName || detectedGroupName) {
      return {
        detectedClassName,
        detectedGroupName
      };
    }
  }

  const classOnlyMatch = normalizedValue.match(/\b(?:class(?:e)?|classe)\b\s*[:\-]?\s*(.+)$/iu);
  if (classOnlyMatch) {
    return {
      detectedClassName: classOnlyMatch[1].trim() || null,
      detectedGroupName: null
    };
  }

  const groupOnlyMatch = normalizedValue.match(/\b(?:group(?:e)?|groupe)\b\s*[:\-]?\s*(.+)$/iu);
  if (groupOnlyMatch) {
    return {
      detectedClassName: null,
      detectedGroupName: groupOnlyMatch[1].trim() || null
    };
  }

  return {
    detectedClassName: normalizedValue,
    detectedGroupName: null
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

  const requiredHeaders = ['firstName', 'lastName', 'schoolEmail', 'groupValue'] as const;

  if (rows.length === 0) {
    return {
      ok: false,
      message: 'The uploaded CSV is empty.',
      rows: []
    };
  }

  const [headerRow, ...dataRows] = rows;
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
      message:
        'Missing required headers. Expected first name, last name, school email, and groups columns.',
      rows: []
    };
  }

  const normalizedRows = dataRows
    .map((columns, rowIndex) => {
      const values: BoostcampGroupedImportRowInput = {
        firstName: '',
        lastName: '',
        schoolEmail: '',
        groupValue: '',
        detectedClassName: null,
        detectedGroupName: null
      };

      headerMap.forEach((header, columnIndex) => {
        if (!header) {
          return;
        }

        if (header === 'groupValue') {
          values.groupValue = columns[columnIndex] ?? '';
          return;
        }

        values[header] = columns[columnIndex] ?? '';
      });

      const { detectedClassName, detectedGroupName } = splitBoostcampGroupValue(values.groupValue);
      values.detectedClassName = detectedClassName;
      values.detectedGroupName = detectedGroupName;

      return {
        id: `row-${rowIndex + 1}`,
        rowNumber: rowIndex + 2,
        values
      };
    })
    .filter((row) =>
      Object.values(row.values).some((value) =>
        typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
      )
    );

  if (normalizedRows.length === 0) {
    return {
      ok: false,
      message: 'The uploaded CSV has headers but no student rows.',
      rows: []
    };
  }

  const emailCounts = new Map<string, number>();
  for (const row of normalizedRows) {
    const normalizedEmail = row.values.schoolEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      continue;
    }

    emailCounts.set(normalizedEmail, (emailCounts.get(normalizedEmail) ?? 0) + 1);
  }

  const previewRows = normalizedRows.map((row) => {
    const normalizedValues: BoostcampGroupedImportRowInput = {
      firstName: normalizeRowValue(row.values.firstName),
      lastName: normalizeRowValue(row.values.lastName),
      schoolEmail: normalizeRowValue(row.values.schoolEmail).toLowerCase(),
      groupValue: normalizeRowValue(row.values.groupValue),
      detectedClassName: row.values.detectedClassName?.trim() || null,
      detectedGroupName: row.values.detectedGroupName?.trim() || null
    };

    const errors: BoostcampGroupedImportRowError = {};
    const parsed = studentImportRowSchema.safeParse({
      firstName: normalizedValues.firstName,
      lastName: normalizedValues.lastName,
      schoolEmail: normalizedValues.schoolEmail,
      userId: ''
    });

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

    if (normalizedValues.schoolEmail && (emailCounts.get(normalizedValues.schoolEmail) ?? 0) > 1) {
      errors.schoolEmail = 'Duplicate email in this file';
    }

    const issues: string[] = [];
    if (!normalizedValues.detectedClassName) {
      issues.push('no class detected');
    }
    if (!normalizedValues.detectedGroupName) {
      issues.push('no group detected');
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

  return {
    ok: true,
    rows: previewRows,
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

export function parseBoostcampGroupedCsv(csvText: string) {
  const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (!normalizedText) {
    return {
      ok: false,
      message: 'The uploaded CSV is empty.',
      rows: []
    };
  }

  let parsedRows: string[][];

  try {
    parsedRows = parseCommaDelimitedText(normalizedText);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to parse the uploaded CSV.',
      rows: []
    };
  }

  return parseBoostcampGroupedTableRows(parsedRows);
}
