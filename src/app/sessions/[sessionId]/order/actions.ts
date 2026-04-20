'use server';

import { and, asc, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db, groups, sessions, submissions } from '@/db';
import { GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES } from '@/lib/group-submission';
import { getOrderedGroups, randomizePresentationOrder } from './presentation-order';

const orderPath = (sessionId: string) => `/sessions/${sessionId}/order`;
const groupsPath = (sessionId: string) => `/sessions/${sessionId}/groups`;
const evaluationPath = (sessionId: string) => `/sessions/${sessionId}/evaluation`;
const sessionHubPath = (sessionId: string) => `/sessions/${sessionId}`;

const sessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session id')
});

const moveSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  groupId: z.string().uuid('Invalid group id'),
  direction: z.enum(['up', 'down'])
});

const uploadSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  groupId: z.string().uuid('Invalid group id'),
  returnTo: z.string().optional()
});

function redirectWithMessage(
  sessionId: string,
  kind: 'notice' | 'error',
  message: string
): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(`${orderPath(sessionId)}?${params.toString()}`);
}

async function getSession(sessionId: string) {
  const rows = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      slug: sessions.slug
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return rows[0] ?? null;
}

function redirectNotice(sessionId: string, message: string): never {
  redirectWithMessage(sessionId, 'notice', message);
}

function resolveSubmissionReturnPath(sessionId: string, returnTo: string | undefined) {
  const fallback = orderPath(sessionId);
  if (!returnTo) {
    return fallback;
  }

  return returnTo === '/sessions' || returnTo.startsWith(`/sessions/${sessionId}`) ? returnTo : fallback;
}

function redirectSubmissionMessage(
  sessionId: string,
  returnTo: string | undefined,
  kind: 'notice' | 'error',
  message: string
): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(`${resolveSubmissionReturnPath(sessionId, returnTo)}?${params.toString()}`);
}

async function persistGroupSubmission(input: {
  file: File;
  groupId: string;
  sessionId: string;
}) {
  const existingSubmission = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(and(eq(submissions.sessionId, input.sessionId), eq(submissions.groupId, input.groupId)))
    .limit(1);

  const content = Buffer.from(await input.file.arrayBuffer()).toString('base64');

  await db.transaction(async (tx) => {
    if (existingSubmission.length > 0) {
      await tx.delete(submissions).where(eq(submissions.id, existingSubmission[0].id));
    }

    await tx.insert(submissions).values({
      sessionId: input.sessionId,
      groupId: input.groupId,
      title: input.file.name,
      content,
      submittedAt: new Date()
    });
  });
}

export async function randomizePresentationOrderAction(formData: FormData): Promise<never> {
  const parsed = sessionSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? '')
  });

  if (!parsed.success) {
    redirectWithMessage('invalid', 'error', 'Invalid session id.');
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Session not found.');
  }

  const randomized = await randomizePresentationOrder(parsed.data.sessionId);
  if (!randomized.ok) {
    redirectWithMessage(parsed.data.sessionId, 'error', randomized.error);
  }

  redirectNotice(parsed.data.sessionId, 'Presentation order randomized.');
}

export async function movePresentationOrderAction(formData: FormData): Promise<never> {
  const parsed = moveSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? ''),
    groupId: String(formData.get('groupId') ?? ''),
    direction: String(formData.get('direction') ?? '')
  });

  if (!parsed.success) {
    redirectWithMessage(String(formData.get('sessionId') ?? 'invalid'), 'error', 'Choose a valid move direction.');
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Session not found.');
  }

  const orderedGroups = await getOrderedGroups(parsed.data.sessionId);
  const currentIndex = orderedGroups.findIndex((group) => group.id === parsed.data.groupId);

  if (currentIndex === -1) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Group not found.');
  }

  const targetIndex = parsed.data.direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= orderedGroups.length) {
    redirectNotice(parsed.data.sessionId, 'That group is already at the edge of the order.');
  }

  [orderedGroups[currentIndex], orderedGroups[targetIndex]] = [
    orderedGroups[targetIndex],
    orderedGroups[currentIndex]
  ];

  await db.transaction(async (tx) => {
    for (const [index, group] of orderedGroups.entries()) {
      await tx
        .update(groups)
        .set({
          presentationOrder: index + 1,
          updatedAt: new Date()
        })
        .where(and(eq(groups.id, group.id), eq(groups.sessionId, parsed.data.sessionId)));
    }
  });

  revalidatePath(orderPath(parsed.data.sessionId));
  revalidatePath(evaluationPath(parsed.data.sessionId));
  revalidatePath(sessionHubPath(parsed.data.sessionId));
  redirectNotice(parsed.data.sessionId, 'Presentation order updated.');
}

export async function uploadGroupSubmissionAction(formData: FormData): Promise<never> {
  const parsed = uploadSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? ''),
    groupId: String(formData.get('groupId') ?? ''),
    returnTo: String(formData.get('returnTo') ?? '') || undefined
  });

  if (!parsed.success) {
    redirectWithMessage(String(formData.get('sessionId') ?? 'invalid'), 'error', 'Choose a valid group.');
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Session not found.');
  }

  const groupRows = await db
    .select({
      id: groups.id,
      name: groups.name
    })
    .from(groups)
    .where(and(eq(groups.sessionId, parsed.data.sessionId), eq(groups.id, parsed.data.groupId)))
    .limit(1);

  const group = groupRows[0] ?? null;
  if (!group) {
    redirectSubmissionMessage(parsed.data.sessionId, parsed.data.returnTo, 'error', 'Group not found.');
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    redirectSubmissionMessage(
      parsed.data.sessionId,
      parsed.data.returnTo,
      'error',
      'Please choose a file to upload.'
    );
  }

  if (file.size > GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES) {
    redirectSubmissionMessage(
      parsed.data.sessionId,
      parsed.data.returnTo,
      'error',
      `File is too large. Max file size is ${GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
    );
  }

  await persistGroupSubmission({
    file,
    groupId: group.id,
    sessionId: parsed.data.sessionId
  });

  revalidatePath(orderPath(parsed.data.sessionId));
  revalidatePath(groupsPath(parsed.data.sessionId));
  revalidatePath(sessionHubPath(parsed.data.sessionId));
  const returnPath = resolveSubmissionReturnPath(parsed.data.sessionId, parsed.data.returnTo);
  const params = new URLSearchParams({ notice: `${file.name} uploaded for ${group.name}.` });
  redirect(`${returnPath}?${params.toString()}`);
}

export async function uploadSelectedGroupSubmissionsAction(formData: FormData): Promise<never> {
  const parsed = z
    .object({
      sessionId: z.string().uuid('Invalid session id'),
      returnTo: z.string().optional()
    })
    .safeParse({
      sessionId: String(formData.get('sessionId') ?? ''),
      returnTo: String(formData.get('returnTo') ?? '') || undefined
    });

  if (!parsed.success) {
    redirectWithMessage(String(formData.get('sessionId') ?? 'invalid'), 'error', 'Invalid session id.');
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    redirectSubmissionMessage(parsed.data.sessionId, parsed.data.returnTo, 'error', 'Session not found.');
  }

  const groupIds = [...new Set(formData.getAll('groupId').map((value) => String(value)).filter(Boolean))];
  if (groupIds.length === 0) {
    redirectSubmissionMessage(parsed.data.sessionId, parsed.data.returnTo, 'error', 'Group not found.');
  }

  const groupRows = await db
    .select({
      id: groups.id,
      name: groups.name
    })
    .from(groups)
    .where(and(eq(groups.sessionId, parsed.data.sessionId), inArray(groups.id, groupIds)));

  if (groupRows.length !== groupIds.length) {
    redirectSubmissionMessage(parsed.data.sessionId, parsed.data.returnTo, 'error', 'Group not found.');
  }

  const groupById = new Map(groupRows.map((group) => [group.id, group]));
  const uploads: Array<{ file: File; groupId: string; groupName: string }> = [];

  for (const groupId of groupIds) {
    const file = formData.get(`file:${groupId}`);
    if (!(file instanceof File) || file.size === 0) {
      continue;
    }

    if (file.size > GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES) {
      redirectSubmissionMessage(
        parsed.data.sessionId,
        parsed.data.returnTo,
        'error',
        `File is too large. Max file size is ${GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
      );
    }

    const group = groupById.get(groupId);
    if (!group) {
      redirectSubmissionMessage(parsed.data.sessionId, parsed.data.returnTo, 'error', 'Group not found.');
    }

    uploads.push({
      file,
      groupId,
      groupName: group.name
    });
  }

  if (uploads.length === 0) {
    redirectSubmissionMessage(
      parsed.data.sessionId,
      parsed.data.returnTo,
      'error',
      'Please choose at least one file to upload.'
    );
  }

  for (const upload of uploads) {
    await persistGroupSubmission({
      file: upload.file,
      groupId: upload.groupId,
      sessionId: parsed.data.sessionId
    });
  }

  revalidatePath(orderPath(parsed.data.sessionId));
  revalidatePath(groupsPath(parsed.data.sessionId));
  revalidatePath(sessionHubPath(parsed.data.sessionId));

  const notice =
    uploads.length === 1
      ? `${uploads[0].file.name} uploaded for ${uploads[0].groupName}.`
      : `${uploads.length} files uploaded.`;

  redirectSubmissionMessage(parsed.data.sessionId, parsed.data.returnTo, 'notice', notice);
}
