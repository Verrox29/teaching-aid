import { z } from 'zod';

const headerAliases: Record<keyof StudentImportRowInput, string[]> = {
  firstName: ['first_name', 'firstname', 'first name', 'prenom', 'prénom'],
  lastName: ['last_name', 'lastname', 'last name', 'nom'],
  schoolEmail: ['school_email', 'email', 'e-mail', 'mail']
};

const requiredHeaders = ['firstName', 'lastName', 'schoolEmail'] as const;

const studentImportRowSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  schoolEmail: z.string().trim().min(1, 'School email is required').email('School email is invalid')
});

export type StudentImportRowInput = {
  firstName: string;
  lastName: string;
  schoolEmail: string;
};

export type StudentImportRowError = Partial<Record<keyof StudentImportRowInput, string>>;

export type StudentImportPreviewRow = {
  id: string;
  rowNumber: number;
  values: StudentImportRowInput;
  errors: StudentImportRowError;
  isValid: boolean;
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
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
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

function parseCsvLine(line: string) {
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

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  if (inQuotes) {
    throw new Error('Malformed CSV: unmatched quote found.');
  }

  values.push(current);
  return values;
}

function parseCsvText(csvText: string) {
  const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (!normalizedText) {
    return [];
  }

  return normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

function validateRows(
  rows: Array<{ id: string; rowNumber: number; values: StudentImportRowInput }>,
  existingEmails: string[]
) {
  const normalizedExistingEmails = new Set(existingEmails.map((email) => email.trim().toLowerCase()));
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

export function revalidateStudentImportRows(
  rows: Array<{ id: string; rowNumber: number; values: StudentImportRowInput }>,
  existingEmails: string[]
) {
  return validateRows(rows, existingEmails);
}

export function parseStudentCsv(
  csvText: string,
  existingEmails: string[]
): StudentImportParseResult {
  let parsedCsv: string[][];

  try {
    parsedCsv = parseCsvText(csvText);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to parse the CSV file.',
      rows: []
    };
  }

  if (parsedCsv.length === 0) {
    return {
      ok: false,
      message: 'The uploaded file is empty.',
      rows: []
    };
  }

  const [headerRow, ...dataRows] = parsedCsv;
  const headerMap = headerRow.map(toCanonicalHeader);
  const missingHeaders = requiredHeaders.filter((header) => !headerMap.includes(header));

  if (missingHeaders.length > 0) {
    return {
      ok: false,
      message: 'Missing required headers. Expected first name, last name, and school email columns.',
      rows: []
    };
  }

  if (dataRows.length === 0) {
    return {
      ok: false,
      message: 'The uploaded file has headers but no student rows.',
      rows: []
    };
  }

  const rows = dataRows.map((columns, rowIndex) => {
    const values: StudentImportRowInput = {
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
  });

  const previewRows = validateRows(rows, existingEmails);

  return {
    ok: true,
    rows: previewRows,
    message: previewRows.every((row) => row.isValid)
      ? 'CSV parsed successfully. Ready to import.'
      : 'Review the highlighted rows before importing.'
  };
}
