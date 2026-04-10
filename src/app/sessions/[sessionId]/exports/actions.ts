'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  activateExportVersions,
  getActiveExportVersions,
  saveExportMappingVersion,
  saveExportTemplateVersion,
  upsertSessionExportMetadata
} from '@/lib/exports/repository';
import {
  DEFAULT_EXPORT_MAPPING_VERSION,
  DEFAULT_PAIRAGOGIE_MAPPING
} from '@/lib/exports/defaults';
import type { PairagogieExportMapping, SessionExportMetadata } from '@/lib/exports/types';
import { validatePairagogieTemplateBuffer } from '@/lib/exports/validator';

const settingsPath = (sessionId: string) => `/sessions/${sessionId}/exports/settings`;
const exportsPath = (sessionId: string) => `/sessions/${sessionId}/exports`;

const metadataSchema = z.object({
  className: z.string().trim().optional().default(''),
  professorName: z.string().trim().optional().default(''),
  programme: z.string().trim().optional().default(''),
  season: z.string().trim().optional().default(''),
  sessionDate: z.string().trim().optional().default(''),
  subject: z.string().trim().optional().default(''),
  sessionId: z.string().uuid('Invalid session id')
});

function redirectWithNotice(sessionId: string, kind: 'notice' | 'error', message: string): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(`${settingsPath(sessionId)}?${params.toString()}`);
}

function parseActivateFlag(formData: FormData) {
  const value = String(formData.get('activate') ?? 'off');
  return value === 'on' || value === 'true' || value === '1';
}

function normalizeMapping(input: unknown): PairagogieExportMapping {
  if (!input || typeof input !== 'object') {
    throw new Error('Mapping must be a JSON object.');
  }

  const record = input as Partial<PairagogieExportMapping>;

  return {
    ...DEFAULT_PAIRAGOGIE_MAPPING,
    ...record,
    cells: {
      ...DEFAULT_PAIRAGOGIE_MAPPING.cells,
      ...record.cells
    },
    expectedFormulaCells:
      record.expectedFormulaCells && record.expectedFormulaCells.length > 0
        ? record.expectedFormulaCells
        : DEFAULT_PAIRAGOGIE_MAPPING.expectedFormulaCells,
    expectedMergedRanges:
      record.expectedMergedRanges && record.expectedMergedRanges.length > 0
        ? record.expectedMergedRanges
        : DEFAULT_PAIRAGOGIE_MAPPING.expectedMergedRanges,
    rubric: {
      ...DEFAULT_PAIRAGOGIE_MAPPING.rubric,
      ...record.rubric,
      columns: {
        ...DEFAULT_PAIRAGOGIE_MAPPING.rubric.columns,
        ...record.rubric?.columns
      }
    }
  } satisfies PairagogieExportMapping;
}

function parseMappingText(rawValue: string): PairagogieExportMapping {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error('Mapping cannot be empty.');
  }

  if (trimmed.startsWith('{')) {
    return normalizeMapping(JSON.parse(trimmed));
  }

  const entries: Record<string, string> = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const content = line.trim();
    if (!content || content.startsWith('#')) {
      continue;
    }

    const separatorIndex = content.indexOf(':') >= 0 ? content.indexOf(':') : content.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`Invalid mapping line: "${line}". Use "key: value".`);
    }

    const key = content.slice(0, separatorIndex).trim();
    const value = content.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      throw new Error(`Invalid mapping line: "${line}".`);
    }
    entries[key] = value;
  }

  const cells: Partial<PairagogieExportMapping['cells']> = {};
  for (const key of Object.keys(DEFAULT_PAIRAGOGIE_MAPPING.cells) as Array<
    keyof PairagogieExportMapping['cells']
  >) {
    if (entries[key]) {
      cells[key] = entries[key];
    }
  }

  return normalizeMapping({
    cells,
    expectedFormulaCells: entries['rubric.totalScore']
      ? [entries['rubric.totalScore']]
      : DEFAULT_PAIRAGOGIE_MAPPING.expectedFormulaCells,
    expectedMergedRanges: DEFAULT_PAIRAGOGIE_MAPPING.expectedMergedRanges,
    rubric: {
      columns: {
        aiDraft: entries['rubric.criteria.columns.aiDraft'] ?? DEFAULT_PAIRAGOGIE_MAPPING.rubric.columns.aiDraft,
        feedback: entries['rubric.criteria.columns.feedback'] ?? DEFAULT_PAIRAGOGIE_MAPPING.rubric.columns.feedback,
        label: entries['rubric.criteria.columns.label'] ?? DEFAULT_PAIRAGOGIE_MAPPING.rubric.columns.label,
        maxScore: entries['rubric.criteria.columns.maxScore'] ?? DEFAULT_PAIRAGOGIE_MAPPING.rubric.columns.maxScore,
        score: entries['rubric.criteria.columns.score'] ?? DEFAULT_PAIRAGOGIE_MAPPING.rubric.columns.score
      },
      maxRows: Number(entries['rubric.criteria.maxRows'] ?? DEFAULT_PAIRAGOGIE_MAPPING.rubric.maxRows),
      startRow: Number(entries['rubric.criteria.startRow'] ?? DEFAULT_PAIRAGOGIE_MAPPING.rubric.startRow)
    },
    sheetName: entries['sheetName'] ?? DEFAULT_PAIRAGOGIE_MAPPING.sheetName,
    version: entries['version'] ?? `mapping-${randomBytes(3).toString('hex')}`
  });
}

export async function saveExportMetadataAction(
  formData: FormData
): Promise<never> {
  const parsed = metadataSchema.safeParse({
    className: String(formData.get('className') ?? ''),
    professorName: String(formData.get('professorName') ?? ''),
    programme: String(formData.get('programme') ?? ''),
    season: String(formData.get('season') ?? ''),
    sessionDate: String(formData.get('sessionDate') ?? ''),
    sessionId: String(formData.get('sessionId') ?? ''),
    subject: String(formData.get('subject') ?? '')
  });

  if (!parsed.success) {
    redirectWithNotice(String(formData.get('sessionId') ?? 'invalid'), 'error', 'Invalid export metadata.');
  }

  const { sessionId, ...metadata } = parsed.data;
  await upsertSessionExportMetadata(sessionId, metadata as SessionExportMetadata);

  revalidatePath(settingsPath(sessionId));
  revalidatePath(exportsPath(sessionId));
  redirectWithNotice(sessionId, 'notice', 'Export metadata saved.');
}

export async function saveExportTemplateAction(
  formData: FormData
): Promise<never> {
  const sessionId = String(formData.get('sessionId') ?? '');
  const file = formData.get('templateFile');
  const activate = parseActivateFlag(formData);

  if (!(file instanceof File) || file.size === 0) {
    redirectWithNotice(sessionId, 'error', 'Choose a template file to upload.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const template = await saveExportTemplateVersion({
    buffer,
    fileName: file.name || 'grille-pairagogie.xlsx'
  });

  const { mapping } = await getActiveExportVersions();
  const validation = validatePairagogieTemplateBuffer(buffer, mapping.mappingJson);
  if (!validation.ok) {
    redirectWithNotice(
      sessionId,
      'error',
      `Template validation failed: ${validation.issues.map((issue) => issue.message).join(' ')}`
    );
  }

  if (activate) {
    await activateExportVersions(template.version, mapping.version);
  }

  revalidatePath(settingsPath(sessionId));
  revalidatePath(exportsPath(sessionId));
  redirectWithNotice(
    sessionId,
    activate ? 'notice' : 'notice',
    activate ? 'Template uploaded and activated.' : 'Template uploaded as a draft version.'
  );
}

export async function saveExportMappingAction(
  formData: FormData
): Promise<never> {
  const sessionId = String(formData.get('sessionId') ?? '');
  const rawMapping = String(formData.get('mappingText') ?? '');
  const activate = parseActivateFlag(formData);

  try {
    const mapping = parseMappingText(rawMapping);
    const { template } = await getActiveExportVersions();
    const templateBuffer = Buffer.from(template.contentBase64, 'base64');
    const validation = validatePairagogieTemplateBuffer(templateBuffer, mapping);
    if (!validation.ok) {
      redirectWithNotice(
        sessionId,
        'error',
        `Mapping validation failed: ${validation.issues.map((issue) => issue.message).join(' ')}`
      );
    }

    const savedMapping = await saveExportMappingVersion({
      mapping,
      templateVersion: template.version
    });

    if (activate) {
      await activateExportVersions(template.version, savedMapping.version);
    }

    revalidatePath(settingsPath(sessionId));
    revalidatePath(exportsPath(sessionId));
    redirectWithNotice(
      sessionId,
      activate ? 'notice' : 'notice',
      activate ? 'Mapping activated.' : 'Mapping saved as a draft version.'
    );
  } catch (error) {
    redirectWithNotice(
      sessionId,
      'error',
      error instanceof Error ? error.message : 'Invalid mapping text.'
    );
  }
}
