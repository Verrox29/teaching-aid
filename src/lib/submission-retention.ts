import { sql } from 'drizzle-orm';

import { db, submissions } from '@/db';

export const SUBMISSION_RETENTION_DAYS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SUBMISSION_RETENTION_MS = SUBMISSION_RETENTION_DAYS * MS_PER_DAY;

type SubmissionRetentionSource = {
  createdAt: Date;
  submittedAt: Date | null;
};

function getSubmissionRetentionStart(submission: SubmissionRetentionSource) {
  return submission.submittedAt ?? submission.createdAt;
}

export function getSubmissionDeletionDate(submission: SubmissionRetentionSource) {
  return new Date(getSubmissionRetentionStart(submission).getTime() + SUBMISSION_RETENTION_MS);
}

export function getLatestSubmissionDeletionDate(submissionsToCheck: SubmissionRetentionSource[]) {
  let latestDeletionDate: Date | null = null;

  for (const submission of submissionsToCheck) {
    const deletionDate = getSubmissionDeletionDate(submission);
    if (!latestDeletionDate || deletionDate > latestDeletionDate) {
      latestDeletionDate = deletionDate;
    }
  }

  return latestDeletionDate;
}

export async function cleanupExpiredSubmissions() {
  const cutoff = new Date(Date.now() - SUBMISSION_RETENTION_MS);

  await db.delete(submissions).where(sql`coalesce(${submissions.submittedAt}, ${submissions.createdAt}) < ${cutoff}`);
}
