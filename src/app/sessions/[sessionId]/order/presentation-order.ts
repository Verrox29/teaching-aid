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
      id: sessions.id,
      presentationOrderLocked: sessions.presentationOrderLocked
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return rows[0] ?? null;
}

async function getOrderedGroups(sessionId: string) {
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

export async function randomizePresentationOrder(sessionId: string): Promise<RandomizePresentationOrderResult> {
  const session = await getSession(sessionId);

  if (!session) {
    return { error: 'Session not found.', ok: false };
  }

  if (session.presentationOrderLocked) {
    return { error: 'Presentation order is locked.', ok: false };
  }

  const orderedGroups = await getOrderedGroups(sessionId);
  if (orderedGroups.length === 0) {
    return { error: 'Create groups before generating an order.', ok: false };
  }

  const randomizedGroups = shuffle(orderedGroups);

  await db.transaction(async (tx) => {
    for (const [index, group] of randomizedGroups.entries()) {
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

  return {
    ok: true,
    groups: randomizedGroups.map((group, index) => ({
      groupId: group.id,
      groupName: group.name,
      presentationOrder: index + 1
    }))
  };
}
