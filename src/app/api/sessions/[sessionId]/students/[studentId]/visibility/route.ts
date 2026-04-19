import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { db, groupMembers, sessionStudents, sessions } from '@/db';

const requestSchema = z.object({
  action: z.enum(['ignore', 'restore'])
});

type RouteParams = {
  params: Promise<{ sessionId: string; studentId: string }>;
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
      id: sessionStudents.id,
      isIgnored: sessionStudents.isIgnored
    })
    .from(sessionStudents)
    .where(and(eq(sessionStudents.sessionId, sessionId), eq(sessionStudents.id, studentId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { sessionId, studentId } = await params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid visibility payload.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    const student = await getStudent(sessionId, studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    if (parsed.data.action === 'ignore') {
      await db.transaction(async (tx) => {
        await tx
          .update(sessionStudents)
          .set({
            isIgnored: true,
            updatedAt: new Date()
          })
          .where(and(eq(sessionStudents.sessionId, sessionId), eq(sessionStudents.id, studentId)));

        await tx
          .delete(groupMembers)
          .where(and(eq(groupMembers.sessionId, sessionId), eq(groupMembers.sessionStudentId, studentId)));
      });
    } else {
      await db
        .update(sessionStudents)
        .set({
          isIgnored: false,
          updatedAt: new Date()
        })
        .where(and(eq(sessionStudents.sessionId, sessionId), eq(sessionStudents.id, studentId)));
    }

    revalidatePath(`/sessions/${sessionId}/groups`);
    revalidatePath(`/sessions/${sessionId}/evaluation`);
    revalidatePath(`/sessions/${sessionId}/exports`);
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/s/${session.slug}`);
    revalidatePath(`/s/${session.slug}/join`);
    revalidatePath('/sessions');

    return NextResponse.json({
      ok: true,
      student: {
        id: student.id,
        isIgnored: parsed.data.action === 'ignore'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update the student visibility.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
