import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db, groups, sessions } from '@/db';

const orderPath = (sessionId: string) => `/sessions/${sessionId}/order`;
const evaluationPath = (sessionId: string) => `/sessions/${sessionId}/evaluation`;
const sessionHubPath = (sessionId: string) => `/sessions/${sessionId}`;

export type RandomizedPresentationGroup = {
  groupId: string;
  groupName: string;
  presentationOrder: number;
};

export type RandomizePresentationOrderResult =
  | { ok: true; groups: RandomizedPresentationGroup[] }
  | { ok: false; error: string };

export type ReorderPresentationOrderResult =
  | { ok: true; groups: RandomizedPresentationGroup[] }
  | { ok: false; error: string };

function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

async function getSession(sessionId: string) {
  const rows = await db
    .select({
      id: sessions.id
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getOrderedGroups(sessionId: string) {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      presentationOrder: groups.presentationOrder,
      createdAt: groups.createdAt
    })
    .from(groups)
    .where(eq(groups.sessionId, sessionId))
    .orderBy(asc(groups.createdAt));

  return rows.sort((left, right) => {
    const leftOrder = left.presentationOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.presentationOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

async function persistPresentationOrder(
  sessionId: string,
  orderedGroups: Array<{ id: string; name: string }>
): Promise<RandomizedPresentationGroup[]> {
  await db.transaction(async (tx) => {
    for (const [index, group] of orderedGroups.entries()) {
      await tx
        .update(groups)
        .set({
          presentationOrder: index + 1,
          updatedAt: new Date()
        })
        .where(and(eq(groups.id, group.id), eq(groups.sessionId, sessionId)));
    }
  });

  revalidatePath(orderPath(sessionId));
  revalidatePath(evaluationPath(sessionId));
  revalidatePath(sessionHubPath(sessionId));

  return orderedGroups.map((group, index) => ({
    groupId: group.id,
    groupName: group.name,
    presentationOrder: index + 1
  }));
}

export async function randomizePresentationOrder(sessionId: string): Promise<RandomizePresentationOrderResult> {
  const session = await getSession(sessionId);

  if (!session) {
    return { error: 'Session not found.', ok: false };
  }

  const orderedGroups = await getOrderedGroups(sessionId);
  if (orderedGroups.length === 0) {
    return { error: 'Create groups before generating an order.', ok: false };
  }

  const randomizedGroups = shuffle(orderedGroups);
  const groups = await persistPresentationOrder(sessionId, randomizedGroups);

  return { ok: true, groups };
}

export async function reorderPresentationOrder(
  sessionId: string,
  orderedGroupIds: string[]
): Promise<ReorderPresentationOrderResult> {
  const session = await getSession(sessionId);

  if (!session) {
    return { error: 'Session not found.', ok: false };
  }

  const orderedGroups = await getOrderedGroups(sessionId);
  if (orderedGroups.length === 0) {
    return { error: 'Create groups before generating an order.', ok: false };
  }

  if (orderedGroupIds.length !== orderedGroups.length) {
    return { error: 'Choose a valid order for all groups.', ok: false };
  }

  const groupsById = new Map(orderedGroups.map((group) => [group.id, group]));
  if (orderedGroupIds.some((groupId) => !groupsById.has(groupId))) {
    return { error: 'Choose a valid order for all groups.', ok: false };
  }

  const uniqueIds = new Set(orderedGroupIds);
  if (uniqueIds.size !== orderedGroupIds.length) {
    return { error: 'Choose a valid order for all groups.', ok: false };
  }

  const reorderedGroups = orderedGroupIds.map((groupId) => groupsById.get(groupId) as (typeof orderedGroups)[number]);
  const groups = await persistPresentationOrder(sessionId, reorderedGroups);

  return { ok: true, groups };
}
