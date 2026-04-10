'use server';
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
    reportSheet: {
      ...DEFAULT_PAIRAGOGIE_MAPPING.reportSheet,
      ...record.reportSheet,
      header: {
        ...DEFAULT_PAIRAGOGIE_MAPPING.reportSheet.header,
        ...record.reportSheet?.header
      },
      studentRows: {
        ...DEFAULT_PAIRAGOGIE_MAPPING.reportSheet.studentRows,
        ...record.reportSheet?.studentRows,
        columns: {
          ...DEFAULT_PAIRAGOGIE_MAPPING.reportSheet.studentRows.columns,
          ...record.reportSheet?.studentRows.columns
        }
      },
      expectedLabels:
        record.reportSheet?.expectedLabels && record.reportSheet.expectedLabels.length > 0
          ? record.reportSheet.expectedLabels
          : DEFAULT_PAIRAGOGIE_MAPPING.reportSheet.expectedLabels
    },
    groupSheet: {
      ...DEFAULT_PAIRAGOGIE_MAPPING.groupSheet,
      ...record.groupSheet,
      sessionFields: {
        ...DEFAULT_PAIRAGOGIE_MAPPING.groupSheet.sessionFields,
        ...record.groupSheet?.sessionFields
      },
      studentNames: {
        ...DEFAULT_PAIRAGOGIE_MAPPING.groupSheet.studentNames,
        ...record.groupSheet?.studentNames
      },
      rubricBlocks: {
        block1: {
          ...DEFAULT_PAIRAGOGIE_MAPPING.groupSheet.rubricBlocks.block1,
          ...record.groupSheet?.rubricBlocks?.block1
        },
        block2: {
          ...DEFAULT_PAIRAGOGIE_MAPPING.groupSheet.rubricBlocks.block2,
          ...record.groupSheet?.rubricBlocks?.block2
        }
      },
      expectedLabels:
        record.groupSheet?.expectedLabels && record.groupSheet.expectedLabels.length > 0
          ? record.groupSheet.expectedLabels
          : DEFAULT_PAIRAGOGIE_MAPPING.groupSheet.expectedLabels
    }
  } satisfies PairagogieExportMapping;
}

function parseMappingText(rawValue: string): PairagogieExportMapping {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error('Mapping cannot be empty.');
  }

  if (!trimmed.startsWith('{')) {
    throw new Error('Mapping text must be structured JSON.');
  }

  return normalizeMapping(JSON.parse(trimmed));
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
