import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { db, groupMembers, groups, sessionStudents, sessions } from '@/db';

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('adjust'),
    adjustment: z.number().int({
      message: 'Adjustments must be signed whole numbers.'
    }),
    sessionStudentId: z.string().uuid('Invalid student id')
  }),
  z.object({
    action: z.literal('move'),
    groupId: z.string().uuid('Invalid group id'),
    sessionStudentId: z.string().uuid('Invalid student id')
  }),
  z.object({
    action: z.literal('remove'),
    sessionStudentId: z.string().uuid('Invalid student id')
  })
]);

type RouteParams = {
  params: Promise<{ sessionId: string }>;
};

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

async function getStudent(sessionId: string, studentId: string) {
  const rows = await db
    .select({
      id: sessionStudents.id
    })
    .from(sessionStudents)
    .where(
      and(
        eq(sessionStudents.sessionId, sessionId),
        eq(sessionStudents.id, studentId),
        eq(sessionStudents.isIgnored, false)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

async function getMembership(sessionId: string, studentId: string) {
  const rows = await db
    .select({
      groupId: groupMembers.groupId
    })
    .from(groupMembers)
    .where(and(eq(groupMembers.sessionId, sessionId), eq(groupMembers.sessionStudentId, studentId)))
    .limit(1);

  return rows[0] ?? null;
}

async function getGroup(sessionId: string, groupId: string) {
  const rows = await db
    .select({
      capacity: groups.capacity,
      id: groups.id
    })
    .from(groups)
    .where(and(eq(groups.sessionId, sessionId), eq(groups.id, groupId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { sessionId } = await params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid roster payload.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    const student = await getStudent(sessionId, parsed.data.sessionStudentId);
    if (!student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    if (parsed.data.action === 'adjust') {
      await db
        .update(sessionStudents)
        .set({
          gradeAdjustment: parsed.data.adjustment,
          updatedAt: new Date()
        })
        .where(and(eq(sessionStudents.sessionId, sessionId), eq(sessionStudents.id, student.id)));
    } else if (parsed.data.action === 'move') {
      const destinationGroup = await getGroup(sessionId, parsed.data.groupId);
      if (!destinationGroup) {
        return NextResponse.json({ error: 'Destination group not found.' }, { status: 404 });
      }

      const currentMembership = await getMembership(sessionId, student.id);
      if (currentMembership?.groupId === destinationGroup.id) {
        return NextResponse.json({ ok: true });
      }

      const memberCountRows = await db
        .select({ id: groupMembers.id })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, destinationGroup.id));

      if (
        memberCountRows.length >= destinationGroup.capacity &&
        currentMembership?.groupId !== destinationGroup.id
      ) {
        return NextResponse.json({ error: 'That destination group is already full.' }, { status: 400 });
      }

      await db.transaction(async (tx) => {
        if (currentMembership) {
          await tx
            .update(groupMembers)
            .set({ groupId: destinationGroup.id })
            .where(and(eq(groupMembers.sessionId, sessionId), eq(groupMembers.sessionStudentId, student.id)));
          return;
        }

        await tx.insert(groupMembers).values({
          groupId: destinationGroup.id,
          sessionId,
          sessionStudentId: student.id
        });
      });
    } else {
      await db
        .delete(groupMembers)
        .where(and(eq(groupMembers.sessionId, sessionId), eq(groupMembers.sessionStudentId, student.id)));
    }

    revalidatePath(`/sessions/${sessionId}/evaluation`);
    revalidatePath(`/sessions/${sessionId}/exports`);
    revalidatePath(`/sessions/${sessionId}/groups`);
    revalidatePath(`/s/${session.slug}`);
    revalidatePath(`/s/${session.slug}/join`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update roster.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
