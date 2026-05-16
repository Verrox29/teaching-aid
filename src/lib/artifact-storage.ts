const REPO_ARTIFACTS_ROOT = 'artifacts';
const REFERENCE_VERSION = 1 as const;

export type ArtifactStorageBackend = 'repo-file';
export type ArtifactKind = 'submission-upload' | 'export-template';

type ArtifactReferenceBase = {
  backend: ArtifactStorageBackend;
  byteSize: number | null;
  checksumSha256: string | null;
  createdAt: string;
  fileName: string;
  kind: ArtifactKind;
  mimeType: string | null;
  path: string;
  version: typeof REFERENCE_VERSION;
};

export type SubmissionArtifactReference = ArtifactReferenceBase & {
  groupId: string;
  kind: 'submission-upload';
  sessionId: string;
};

export type ExportTemplateArtifactReference = ArtifactReferenceBase & {
  kind: 'export-template';
  templateVersion: string;
};

export type RepoArtifactReference = SubmissionArtifactReference | ExportTemplateArtifactReference;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function padMilliseconds(value: number) {
  return String(value).padStart(3, '0');
}

function compactUtcTimestamp(date: Date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    padMilliseconds(date.getUTCMilliseconds()),
    'Z'
  ].join('');
}

export function sanitizeArtifactFileName(fileName: string) {
  const trimmed = fileName.trim();
  const fallback = trimmed || 'artifact.bin';
  const safe = fallback
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');

  return safe || 'artifact.bin';
}

function sanitizePathSegment(value: string) {
  const safe = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return safe || 'unknown';
}

function normalizeArtifactRelativePath(path: string) {
  const normalized = path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .trim();

  if (!normalized || normalized.includes('..')) {
    throw new Error('Invalid artifact relative path.');
  }

  return normalized;
}

export function buildSubmissionArtifactRelativePath(params: {
  createdAt?: Date;
  fileName: string;
  groupId: string;
  sessionId: string;
}) {
  const createdAt = params.createdAt ?? new Date();
  const timestamp = compactUtcTimestamp(createdAt);
  const sessionSegment = sanitizePathSegment(params.sessionId);
  const groupSegment = sanitizePathSegment(params.groupId);
  const safeFileName = sanitizeArtifactFileName(params.fileName);

  return normalizeArtifactRelativePath(
    `${REPO_ARTIFACTS_ROOT}/submissions/${sessionSegment}/${groupSegment}/${timestamp}-${safeFileName}`
  );
}

export function buildExportTemplateArtifactRelativePath(params: {
  createdAt?: Date;
  fileName: string;
  templateVersion: string;
}) {
  const createdAt = params.createdAt ?? new Date();
  const timestamp = compactUtcTimestamp(createdAt);
  const templateSegment = sanitizePathSegment(params.templateVersion);
  const safeFileName = sanitizeArtifactFileName(params.fileName);

  return normalizeArtifactRelativePath(
    `${REPO_ARTIFACTS_ROOT}/export-templates/${templateSegment}/${timestamp}-${safeFileName}`
  );
}

export function buildSubmissionArtifactReference(params: {
  byteSize?: number | null;
  checksumSha256?: string | null;
  createdAt?: Date;
  fileName: string;
  groupId: string;
  mimeType?: string | null;
  sessionId: string;
}): SubmissionArtifactReference {
  const createdAt = params.createdAt ?? new Date();

  return {
    backend: 'repo-file',
    byteSize: params.byteSize ?? null,
    checksumSha256: params.checksumSha256 ?? null,
    createdAt: createdAt.toISOString(),
    fileName: sanitizeArtifactFileName(params.fileName),
    groupId: params.groupId,
    kind: 'submission-upload',
    mimeType: params.mimeType ?? null,
    path: buildSubmissionArtifactRelativePath({
      createdAt,
      fileName: params.fileName,
      groupId: params.groupId,
      sessionId: params.sessionId
    }),
    sessionId: params.sessionId,
    version: REFERENCE_VERSION
  };
}

export function buildExportTemplateArtifactReference(params: {
  byteSize?: number | null;
  checksumSha256?: string | null;
  createdAt?: Date;
  fileName: string;
  mimeType?: string | null;
  templateVersion: string;
}): ExportTemplateArtifactReference {
  const createdAt = params.createdAt ?? new Date();

  return {
    backend: 'repo-file',
    byteSize: params.byteSize ?? null,
    checksumSha256: params.checksumSha256 ?? null,
    createdAt: createdAt.toISOString(),
    fileName: sanitizeArtifactFileName(params.fileName),
    kind: 'export-template',
    mimeType: params.mimeType ?? null,
    path: buildExportTemplateArtifactRelativePath({
      createdAt,
      fileName: params.fileName,
      templateVersion: params.templateVersion
    }),
    templateVersion: params.templateVersion,
    version: REFERENCE_VERSION
  };
}

