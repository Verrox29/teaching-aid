import { NextResponse } from 'next/server';
import { z } from 'zod';

import { persistGroupUpdate } from '@/app/sessions/[sessionId]/groups/actions';

const requestSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
  groupId: z.string().uuid('Invalid group id'),
  name: z.string().trim().min(1, 'Group name is required')
});

type RouteParams = {
  params: Promise<{ groupId: string; sessionId: string }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { groupId, sessionId } = await params;
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => ({
      groupId,
      sessionId
    }))
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid rename payload.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await persistGroupUpdate({
    groupId: parsed.data.groupId,
    name: parsed.data.name,
    sessionId: parsed.data.sessionId
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ groupId: result.groupId, name: result.name });
}
