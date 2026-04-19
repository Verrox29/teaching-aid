'use server';

import { and, asc, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db, groups, sessions, submissions } from '@/db';
import { GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES } from '@/lib/group-submission';
import { randomizePresentationOrder } from './presentation-order';

const orderPath = (sessionId: string) => `/sessions/${sessionId}/order`;
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
  groupId: z.string().uuid('Invalid group id')
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
      slug: sessions.slug,
      presentationOrderLocked: sessions.presentationOrderLocked
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return rows[0] ?? null;
}

function redirectNotice(sessionId: string, message: string): never {
  redirectWithMessage(sessionId, 'notice', message);
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

  if (session.presentationOrderLocked) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Presentation order is locked.');
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

  if (session.presentationOrderLocked) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Presentation order is locked.');
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

async function setPresentationOrderLocked(
  formData: FormData,
  locked: boolean
): Promise<never> {
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

  if (session.presentationOrderLocked === locked) {
    redirectWithMessage(
      parsed.data.sessionId,
      'notice',
      locked ? 'Presentation order is already locked.' : 'Presentation order is already unlocked.'
    );
  }

  await db
    .update(sessions)
    .set({
      presentationOrderLocked: locked,
      presentationOrderLockedAt: locked ? new Date() : null,
      updatedAt: new Date()
    })
    .where(eq(sessions.id, parsed.data.sessionId));

  revalidatePath(orderPath(parsed.data.sessionId));
  revalidatePath(evaluationPath(parsed.data.sessionId));
  revalidatePath(sessionHubPath(parsed.data.sessionId));

  redirectNotice(
    parsed.data.sessionId,
    locked ? 'Presentation order locked.' : 'Presentation order unlocked.'
  );
}

export async function lockPresentationOrderAction(formData: FormData): Promise<never> {
  return setPresentationOrderLocked(formData, true);
}

export async function unlockPresentationOrderAction(formData: FormData): Promise<never> {
  return setPresentationOrderLocked(formData, false);
}

export async function uploadGroupSubmissionAction(formData: FormData): Promise<never> {
  const parsed = uploadSchema.safeParse({
    sessionId: String(formData.get('sessionId') ?? ''),
    groupId: String(formData.get('groupId') ?? '')
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
    redirectWithMessage(parsed.data.sessionId, 'error', 'Group not found.');
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    redirectWithMessage(parsed.data.sessionId, 'error', 'Please choose a file to upload.');
  }

  if (file.size > GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES) {
    redirectWithMessage(
      parsed.data.sessionId,
      'error',
      `File is too large. Max file size is ${GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
    );
  }

  const existingSubmission = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(and(eq(submissions.sessionId, parsed.data.sessionId), eq(submissions.groupId, group.id)))
    .limit(1);

  const content = Buffer.from(await file.arrayBuffer()).toString('base64');

  await db.transaction(async (tx) => {
    if (existingSubmission.length > 0) {
      await tx.delete(submissions).where(eq(submissions.id, existingSubmission[0].id));
    }

    await tx.insert(submissions).values({
      sessionId: parsed.data.sessionId,
      groupId: group.id,
      title: file.name,
      content,
      submittedAt: new Date()
    });
  });

  revalidatePath(orderPath(parsed.data.sessionId));
  revalidatePath(sessionHubPath(parsed.data.sessionId));
  redirectNotice(parsed.data.sessionId, `${file.name} uploaded for ${group.name}.`);
}
