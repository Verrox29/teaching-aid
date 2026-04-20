import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  db,
  evaluationScores,
  evaluations,
  exportHistory,
  exportMappingVersions,
  exportSettings,
  exportTemplateVersions,
  groupMembers,
  groups,
  sessionExportMetadata,
  sessionStudents,
  sessions,
  submissions
} from '@/db';
import { cleanupExpiredSubmissions } from '@/lib/submission-retention';

import {
  DEFAULT_EXPORT_MAPPING_VERSION,
  DEFAULT_EXPORT_TEMPLATE_VERSION,
  DEFAULT_PAIRAGOGIE_MAPPING,
  DEFAULT_PAIRAGOGIE_TEMPLATE_PATH,
  EXPORT_SETTINGS_KEY
} from './defaults';
import { ensurePairagogieRubric } from '@/lib/evaluation/rubric';
import type {
  ExportMappingVersionRecord,
  ExportTemplateVersionRecord,
  PairagogieExportMapping,
  SessionExportMetadata
} from './types';
import { validatePairagogieTemplateBuffer } from './validator';

type SessionExportSummary = {
  className: string;
  professorName: string;
  programme: string;
  season: string;
  sessionDate: string;
  subject: string;
};

type ExportCriterionSnapshot = {
  feedback: string | null;
  id: string;
  label: string;
  maxScore: number;
  score: number | null;
  sortOrder: number;
};

type ExportGroupSnapshot = {
  capacity: number;
  id: string;
  members: Array<{
    firstName: string;
    gradeAdjustment: number;
    id: string;
    lastName: string;
    schoolEmail: string;
  }>;
  name: string;
  presentationOrder: number | null;
  submission: {
    content: string | null;
    fileName: string | null;
    id: string;
    submittedAt: Date | null;
  } | null;
  evaluation: {
    comments: string | null;
    finalFeedback: string | null;
    id: string;
    teacherNotes: string | null;
    totalScore: number;
    updatedAt: Date;
  } | null;
  criteria: ExportCriterionSnapshot[];
};

export type PairagogieExportContext = {
  groups: ExportGroupSnapshot[];
  mapping: PairagogieExportMapping;
  metadata: SessionExportMetadata;
  session: {
    id: string;
    instructions: string | null;
    slug: string;
    title: string;
  };
  template: ExportTemplateVersionRecord;
  validationIssues: string[];
  version: {
    mapping: string;
    template: string;
  };
};

type SessionExportMetadataValues = {
  className: string;
  professorName: string;
  programme: string;
  season: string;
  sessionDate: string;
  subject: string;
};

function hashBuffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function getDefaultMetadata(sessionTitle: string): SessionExportMetadata {
  return {
    className: sessionTitle,
    professorName: '',
    programme: '',
    season: '',
    sessionDate: '',
    subject: ''
  };
}

function normalizeMetadataValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeStoredMetadataRecord(
  record: Partial<SessionExportMetadataValues> | null | undefined
): SessionExportMetadataValues {
  if (!record) {
    return {
      className: '',
      professorName: '',
      programme: '',
      season: '',
      sessionDate: '',
      subject: ''
    };
  }

  return {
    className: normalizeMetadataValue(record.className),
    professorName: normalizeMetadataValue(record.professorName),
    programme: normalizeMetadataValue(record.programme),
    season: normalizeMetadataValue(record.season),
    sessionDate: normalizeMetadataValue(record.sessionDate),
    subject: normalizeMetadataValue(record.subject)
  };
}

function normalizeMetadataRecord(
  record: Partial<SessionExportMetadataValues> | null | undefined,
  sessionTitle: string
): SessionExportMetadata {
  const stored = normalizeStoredMetadataRecord(record);

  return {
    className: stored.className || sessionTitle,
    professorName: stored.professorName,
    programme: stored.programme,
    season: stored.season,
    sessionDate: stored.sessionDate,
    subject: stored.subject
  };
}

function metadataMatches(left: SessionExportMetadataValues, right: SessionExportMetadataValues) {
  return (
    left.className === right.className &&
    left.professorName === right.professorName &&
    left.programme === right.programme &&
    left.season === right.season &&
    left.sessionDate === right.sessionDate &&
    left.subject === right.subject
  );
}

function hasStructuredPairagogieMapping(input: unknown): input is PairagogieExportMapping {
  if (!input || typeof input !== 'object') {
    return false;
  }

  const record = input as Partial<PairagogieExportMapping>;
  return Boolean(record.reportSheet && record.groupSheet);
}

async function loadDefaultTemplateBuffer() {
  return readFile(DEFAULT_PAIRAGOGIE_TEMPLATE_PATH);
}

async function readExportSettings() {
  const rows = await db
    .select({
      activeMappingVersion: exportSettings.activeMappingVersion,
      activeTemplateVersion: exportSettings.activeTemplateVersion
    })
    .from(exportSettings)
    .where(eq(exportSettings.key, EXPORT_SETTINGS_KEY))
    .limit(1);

  return rows[0] ?? null;
}

export async function getActiveExportVersions() {
  const settings = await readExportSettings();
  const templateVersion = settings?.activeTemplateVersion ?? DEFAULT_EXPORT_TEMPLATE_VERSION;
  const mappingVersion = settings?.activeMappingVersion ?? DEFAULT_EXPORT_MAPPING_VERSION;

  const templateRows = await db
    .select({
      contentBase64: exportTemplateVersions.contentBase64,
      checksum: exportTemplateVersions.checksum,
      fileName: exportTemplateVersions.fileName,
      isActive: exportTemplateVersions.isActive,
      updatedAt: exportTemplateVersions.updatedAt,
      version: exportTemplateVersions.version
    })
    .from(exportTemplateVersions)
    .where(eq(exportTemplateVersions.version, templateVersion))
    .limit(1);

  const mappingRows = await db
    .select({
      isActive: exportMappingVersions.isActive,
      mappingJson: exportMappingVersions.mappingJson,
      templateVersion: exportMappingVersions.templateVersion,
      updatedAt: exportMappingVersions.updatedAt,
      version: exportMappingVersions.version
    })
    .from(exportMappingVersions)
    .where(eq(exportMappingVersions.version, mappingVersion))
    .limit(1);

  const defaultTemplateBuffer = await loadDefaultTemplateBuffer();
  const template =
    templateRows[0] ??
    ({
      contentBase64: defaultTemplateBuffer.toString('base64'),
      checksum: hashBuffer(defaultTemplateBuffer),
      fileName: 'grille-pairagogie.xlsx',
      isActive: true,
      updatedAt: new Date(),
      version: DEFAULT_EXPORT_TEMPLATE_VERSION
    } satisfies ExportTemplateVersionRecord);

  const mapping =
    mappingRows[0] ??
    ({
      isActive: true,
      mappingJson: DEFAULT_PAIRAGOGIE_MAPPING,
      templateVersion: DEFAULT_EXPORT_TEMPLATE_VERSION,
      updatedAt: new Date(),
      version: DEFAULT_EXPORT_MAPPING_VERSION
    } satisfies ExportMappingVersionRecord);

  if (!hasStructuredPairagogieMapping(mapping.mappingJson)) {
    mapping.mappingJson = DEFAULT_PAIRAGOGIE_MAPPING;
  }

  return { mapping, settings, template };
}

export async function getSessionExportMetadataRecord(
  sessionId: string,
  sessionTitle: string
): Promise<SessionExportMetadata> {
  const rows = await db
    .select({
      className: sessionExportMetadata.className,
      professorName: sessionExportMetadata.professorName,
      programme: sessionExportMetadata.programme,
      season: sessionExportMetadata.season,
      sessionDate: sessionExportMetadata.sessionDate,
      subject: sessionExportMetadata.subject,
      previousValues: sessionExportMetadata.previousValues
    })
    .from(sessionExportMetadata)
    .where(eq(sessionExportMetadata.sessionId, sessionId))
    .limit(1);

  const stored = rows[0] ?? null;
  if (!stored) {
    return getDefaultMetadata(sessionTitle);
  }

  return normalizeMetadataRecord(stored, sessionTitle);
}

export async function getSessionExportMetadataUndoAvailability(sessionId: string): Promise<boolean> {
  const rows = await db
    .select({
      previousValues: sessionExportMetadata.previousValues
    })
    .from(sessionExportMetadata)
    .where(eq(sessionExportMetadata.sessionId, sessionId))
    .limit(1);

  return Boolean(rows[0]?.previousValues);
}

export async function upsertSessionExportMetadata(
  sessionId: string,
  values: SessionExportMetadata
): Promise<void> {
  const existing = await db
    .select({
      className: sessionExportMetadata.className,
      professorName: sessionExportMetadata.professorName,
      programme: sessionExportMetadata.programme,
      season: sessionExportMetadata.season,
      sessionDate: sessionExportMetadata.sessionDate,
      subject: sessionExportMetadata.subject
    })
    .from(sessionExportMetadata)
    .where(eq(sessionExportMetadata.sessionId, sessionId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(sessionExportMetadata).values({
      ...values,
      sessionId,
      previousValues: null,
      updatedAt: new Date()
    });
    return;
  }

  const current = normalizeStoredMetadataRecord(existing[0]);
  const next = normalizeStoredMetadataRecord(values);

  if (metadataMatches(current, next)) {
    return;
  }

  await db
    .update(sessionExportMetadata)
    .set({
      ...values,
      previousValues: current,
      updatedAt: new Date()
    })
    .where(eq(sessionExportMetadata.sessionId, sessionId));
}

export async function undoSessionExportMetadata(sessionId: string): Promise<boolean> {
  const rows = await db
    .select({
      className: sessionExportMetadata.className,
      professorName: sessionExportMetadata.professorName,
      programme: sessionExportMetadata.programme,
      previousValues: sessionExportMetadata.previousValues,
      season: sessionExportMetadata.season,
      sessionDate: sessionExportMetadata.sessionDate,
      subject: sessionExportMetadata.subject
    })
    .from(sessionExportMetadata)
    .where(eq(sessionExportMetadata.sessionId, sessionId))
    .limit(1);

  const current = rows[0] ?? null;
  if (!current) {
    return false;
  }

  if (!current.previousValues) {
    await db.delete(sessionExportMetadata).where(eq(sessionExportMetadata.sessionId, sessionId));
    return true;
  }

  await db
    .update(sessionExportMetadata)
    .set({
      ...current.previousValues,
      previousValues: null,
      updatedAt: new Date()
    })
    .where(eq(sessionExportMetadata.sessionId, sessionId));

  return true;
}

export async function saveExportTemplateVersion(params: {
  buffer: Buffer;
  fileName: string;
}): Promise<ExportTemplateVersionRecord> {
  const version = `template-${Date.now()}`;
  const record: ExportTemplateVersionRecord = {
    contentBase64: params.buffer.toString('base64'),
    checksum: hashBuffer(params.buffer),
    fileName: params.fileName,
    isActive: false,
    updatedAt: new Date(),
    version
  };

  await db.insert(exportTemplateVersions).values({
    contentBase64: record.contentBase64,
    checksum: record.checksum,
    fileName: record.fileName,
    isActive: false,
    updatedAt: record.updatedAt,
    version: record.version
  });

  return record;
}

export async function saveExportMappingVersion(params: {
  mapping: PairagogieExportMapping;
  templateVersion: string;
}): Promise<ExportMappingVersionRecord> {
  const version = `mapping-${Date.now()}`;
  const record: ExportMappingVersionRecord = {
    isActive: false,
    mappingJson: params.mapping,
    templateVersion: params.templateVersion,
    updatedAt: new Date(),
    version
  };

  await db.insert(exportMappingVersions).values({
    isActive: false,
    mappingJson: record.mappingJson,
    templateVersion: record.templateVersion,
    updatedAt: record.updatedAt,
    version: record.version
  });

  return record;
}

export async function activateExportVersions(templateVersion: string, mappingVersion: string) {
  await db.transaction(async (tx) => {
    const templateRows = await tx
      .select({ version: exportTemplateVersions.version })
      .from(exportTemplateVersions)
      .where(eq(exportTemplateVersions.version, templateVersion))
      .limit(1);

    const mappingRows = await tx
      .select({ version: exportMappingVersions.version })
      .from(exportMappingVersions)
      .where(eq(exportMappingVersions.version, mappingVersion))
      .limit(1);

    if (templateRows.length === 0 || mappingRows.length === 0) {
      throw new Error('Template or mapping version not found.');
    }

    await tx
      .update(exportTemplateVersions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(exportTemplateVersions.isActive, true));

    await tx
      .update(exportMappingVersions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(exportMappingVersions.isActive, true));

    await tx
      .update(exportTemplateVersions)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(exportTemplateVersions.version, templateVersion));

    await tx
      .update(exportMappingVersions)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(exportMappingVersions.version, mappingVersion));

    const existing = await tx
      .select({ key: exportSettings.key })
      .from(exportSettings)
      .where(eq(exportSettings.key, EXPORT_SETTINGS_KEY))
      .limit(1);

    if (existing.length === 0) {
      await tx.insert(exportSettings).values({
        activeMappingVersion: mappingVersion,
        activeTemplateVersion: templateVersion,
        key: EXPORT_SETTINGS_KEY,
        updatedAt: new Date()
      });
      return;
    }

    await tx
      .update(exportSettings)
      .set({
        activeMappingVersion: mappingVersion,
        activeTemplateVersion: templateVersion,
        updatedAt: new Date()
      })
      .where(eq(exportSettings.key, EXPORT_SETTINGS_KEY));
  });
}

export async function listExportTemplateVersions() {
  return db
    .select({
      checksum: exportTemplateVersions.checksum,
      fileName: exportTemplateVersions.fileName,
      isActive: exportTemplateVersions.isActive,
      updatedAt: exportTemplateVersions.updatedAt,
      version: exportTemplateVersions.version
    })
    .from(exportTemplateVersions)
    .orderBy(desc(exportTemplateVersions.createdAt));
}

export async function listExportMappingVersions() {
  return db
    .select({
      isActive: exportMappingVersions.isActive,
      templateVersion: exportMappingVersions.templateVersion,
      updatedAt: exportMappingVersions.updatedAt,
      version: exportMappingVersions.version
    })
    .from(exportMappingVersions)
    .orderBy(desc(exportMappingVersions.createdAt));
}

export async function saveExportHistory(params: {
  exportType: string;
  metadata: Record<string, unknown>;
  requestedBySessionStudentId?: string | null;
  sessionId: string;
}) {
  await db.insert(exportHistory).values({
    exportType: params.exportType,
    metadata: params.metadata,
    requestedBySessionStudentId: params.requestedBySessionStudentId ?? null,
    sessionId: params.sessionId,
    status: 'completed'
  });
}

export async function getPairagogieExportContext(sessionId: string): Promise<PairagogieExportContext> {
  await cleanupExpiredSubmissions();

  const sessionRows = await db
    .select({
      id: sessions.id,
      instructions: sessions.instructions,
      slug: sessions.slug,
      title: sessions.title
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const session = sessionRows[0] ?? null;
  if (!session) {
    throw new Error('Session not found.');
  }

  const { mapping, template } = await getActiveExportVersions();
  const validation = validatePairagogieTemplateBuffer(
    Buffer.from(template.contentBase64, 'base64'),
    mapping.mappingJson
  );

  const metadata = await getSessionExportMetadataRecord(sessionId, session.title);

  const rubric = await ensurePairagogieRubric(sessionId);
  const criteriaRows = rubric.criteria.map((criterion) => ({
    feedback: null,
    id: criterion.id,
    label: criterion.label,
    maxScore: criterion.maxScore,
    score: sql<number | null>`null`,
    sortOrder: criterion.sortOrder
  }));

  const groupRows = await db
    .select({
      capacity: groups.capacity,
      id: groups.id,
      name: groups.name,
      presentationOrder: groups.presentationOrder
    })
    .from(groups)
    .where(eq(groups.sessionId, sessionId))
    .orderBy(asc(groups.createdAt));

  const membershipRows = await db
    .select({
      firstName: sessionStudents.firstName,
      gradeAdjustment: sessionStudents.gradeAdjustment,
      groupId: groupMembers.groupId,
      id: sessionStudents.id,
      lastName: sessionStudents.lastName,
      schoolEmail: sessionStudents.schoolEmail
    })
    .from(groupMembers)
    .innerJoin(sessionStudents, eq(groupMembers.sessionStudentId, sessionStudents.id))
    .where(and(eq(groupMembers.sessionId, sessionId), eq(sessionStudents.isIgnored, false)))
    .orderBy(asc(sessionStudents.lastName), asc(sessionStudents.firstName));

  const membershipByGroupId = new Map<string, ExportGroupSnapshot['members']>();
  for (const membership of membershipRows) {
    const members = membershipByGroupId.get(membership.groupId) ?? [];
    members.push({
      firstName: membership.firstName,
      gradeAdjustment: membership.gradeAdjustment,
      id: membership.id,
      lastName: membership.lastName,
      schoolEmail: membership.schoolEmail
    });
    membershipByGroupId.set(membership.groupId, members);
  }

  const submissionRows = await db
    .select({
      content: submissions.content,
      groupId: submissions.groupId,
      id: submissions.id,
      submittedAt: submissions.submittedAt,
      title: submissions.title
    })
    .from(submissions)
    .where(eq(submissions.sessionId, sessionId));

  const evaluationsRows = await db
    .select({
      comments: evaluations.comments,
      evaluatorGroupId: evaluations.evaluatorGroupId,
      finalFeedback: evaluations.finalFeedback,
      id: evaluations.id,
      submissionId: evaluations.submissionId,
      teacherNotes: evaluations.teacherNotes,
      updatedAt: evaluations.updatedAt
    })
    .from(evaluations)
    .where(eq(evaluations.sessionId, sessionId))
    .orderBy(desc(evaluations.updatedAt));

  const evaluationIds = evaluationsRows.map((evaluation) => evaluation.id);
  const scoreRows =
    evaluationIds.length === 0
      ? []
      : await db
          .select({
            evaluationId: evaluationScores.evaluationId,
            feedback: evaluationScores.feedback,
            rubricCriterionId: evaluationScores.rubricCriterionId,
            score: evaluationScores.score
          })
          .from(evaluationScores)
          .where(inArray(evaluationScores.evaluationId, evaluationIds));

  const scoresByEvaluationId = new Map<string, typeof scoreRows>();
  for (const score of scoreRows) {
    const current = scoresByEvaluationId.get(score.evaluationId) ?? [];
    current.push(score);
    scoresByEvaluationId.set(score.evaluationId, current);
  }

  const latestEvaluationByGroupId = new Map<string, (typeof evaluationsRows)[number]>();
  for (const evaluation of evaluationsRows) {
    if (!latestEvaluationByGroupId.has(evaluation.evaluatorGroupId)) {
      latestEvaluationByGroupId.set(evaluation.evaluatorGroupId, evaluation);
    }
  }

  const groupsWithData: ExportGroupSnapshot[] = groupRows.map((group) => {
    const members = membershipByGroupId.get(group.id) ?? [];
    const submission = submissionRows.find((entry) => entry.groupId === group.id) ?? null;
    const evaluation = latestEvaluationByGroupId.get(group.id) ?? null;
    const scores = evaluation ? scoresByEvaluationId.get(evaluation.id) ?? [] : [];

    return {
      capacity: group.capacity,
      criteria: criteriaRows.map((criterion) => {
        const score = scores.find((entry) => entry.rubricCriterionId === criterion.id) ?? null;
        return {
          feedback: score?.feedback ?? criterion.feedback ?? null,
          id: criterion.id,
          label: criterion.label,
          maxScore: criterion.maxScore,
          score: score?.score ?? null,
          sortOrder: criterion.sortOrder
        };
      }),
      evaluation: evaluation
        ? {
            comments: evaluation.comments,
            finalFeedback: evaluation.finalFeedback,
            id: evaluation.id,
            teacherNotes: evaluation.teacherNotes,
            totalScore: scores.reduce((sum, entry) => sum + entry.score, 0),
            updatedAt: evaluation.updatedAt
          }
        : null,
      id: group.id,
      members,
      name: group.name,
      presentationOrder: group.presentationOrder,
      submission: submission
        ? {
            content: submission.content,
            fileName: submission.title,
            id: submission.id,
            submittedAt: submission.submittedAt
          }
        : null
    };
  });

  return {
    groups: groupsWithData,
    mapping: mapping.mappingJson,
    metadata,
    session,
    template,
    validationIssues: validation.issues.map((issue) => `${issue.target}: ${issue.message}`),
    version: {
      mapping: mapping.version,
      template: template.version
    }
  };
}
