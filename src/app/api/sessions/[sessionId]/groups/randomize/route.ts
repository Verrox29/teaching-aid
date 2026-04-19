import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { db, groupMembers, groups, sessionStudents, sessions } from '@/db';

import { savedGroupsPayloadSchema } from '@/app/sessions/[sessionId]/groups/actions';

const requestSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  groupsJson: z.string().min(1, 'Groups payload is required')
});

function uniqueBy<T>(values: T[]) {
  return new Set(values).size === values.length;
}

function normalizeText(value: string) {
  return value.trim();
}

async function getSession(sessionId: string) {
  const rows = await db
    .select({
      id: sessions.id,
      slug: sessions.slug
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid randomize payload.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const session = await getSession(parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  }

  let groupsPayload: unknown;
  try {
    groupsPayload = JSON.parse(parsed.data.groupsJson);
  } catch {
    return NextResponse.json({ error: 'Could not read the groups payload.' }, { status: 400 });
  }

  const parsedGroups = savedGroupsPayloadSchema.safeParse(groupsPayload);
  if (!parsedGroups.success) {
    return NextResponse.json(
      { error: 'Please review the randomized group data and try again.' },
      { status: 400 }
    );
  }

  const existingGroups = await db
    .select({
      id: groups.id
    })
    .from(groups)
    .where(eq(groups.sessionId, parsed.data.sessionId));

  const existingGroupIds = new Set(existingGroups.map((group) => group.id));
  const submittedGroupIds = new Set(parsedGroups.data.groups.map((group) => group.id));

  if (
    existingGroupIds.size !== submittedGroupIds.size ||
    [...existingGroupIds].some((groupId) => !submittedGroupIds.has(groupId))
  ) {
    return NextResponse.json(
      { error: 'The group list is out of date. Reload the page and try again.' },
      { status: 400 }
    );
  }

  const normalizedNames = parsedGroups.data.groups.map((group) => normalizeText(group.name));
  if (!uniqueBy(normalizedNames)) {
    return NextResponse.json({ error: 'Group names must be unique.' }, { status: 400 });
  }

  const sessionStudentRows = await db
    .select({
      id: sessionStudents.id
    })
    .from(sessionStudents)
    .where(
      and(eq(sessionStudents.sessionId, parsed.data.sessionId), eq(sessionStudents.isIgnored, false))
    );

  const validStudentIds = new Set(sessionStudentRows.map((row) => row.id));
  const memberIds = parsedGroups.data.groups.flatMap((group) => group.memberIds);

  if (!uniqueBy(memberIds)) {
    return NextResponse.json(
      { error: 'A student can only belong to one group.' },
      { status: 400 }
    );
  }

  if (memberIds.some((studentId) => !validStudentIds.has(studentId))) {
    return NextResponse.json(
      { error: 'One or more students are invalid.' },
      { status: 400 }
    );
  }

  for (const group of parsedGroups.data.groups) {
    if (group.memberIds.length > group.capacity) {
      return NextResponse.json(
        { error: 'A group capacity cannot be smaller than the number of students in it.' },
        { status: 400 }
      );
    }
  }

  try {
    await db.transaction(async (tx) => {
      await Promise.all(
        parsedGroups.data.groups.map((group) =>
          tx
            .update(groups)
            .set({
              name: normalizeText(group.name),
              capacity: group.capacity,
              updatedAt: new Date()
            })
            .where(and(eq(groups.id, group.id), eq(groups.sessionId, parsed.data.sessionId)))
        )
      );

      await tx.delete(groupMembers).where(eq(groupMembers.sessionId, parsed.data.sessionId));

      const memberRows = parsedGroups.data.groups.flatMap((group) =>
        group.memberIds.map((sessionStudentId) => ({
          sessionId: parsed.data.sessionId,
          groupId: group.id,
          sessionStudentId
        }))
      );

      if (memberRows.length > 0) {
        await tx.insert(groupMembers).values(memberRows);
      }
    });
  } catch (error) {
    console.error('Failed to randomize group assignments', error);
    return NextResponse.json(
      { error: 'Could not randomize the group assignments. Please try again.' },
      { status: 400 }
    );
  }

  revalidatePath(`/sessions/${parsed.data.sessionId}/groups`);
  revalidatePath(`/sessions/${parsed.data.sessionId}/evaluation`);
  revalidatePath(`/sessions/${parsed.data.sessionId}/exports`);
  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  revalidatePath(`/s/${session.slug}`);
  revalidatePath('/sessions');

  return NextResponse.json({ ok: true });
}
