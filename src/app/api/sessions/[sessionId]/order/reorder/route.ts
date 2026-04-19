import { NextResponse } from 'next/server';
import { z } from 'zod';

import { reorderPresentationOrder } from '@/app/sessions/[sessionId]/order/presentation-order';

const requestSchema = z.object({
  orderedGroupIds: z.array(z.string().uuid()).min(1)
});

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { sessionId } = await params;
  const payload = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid reorder payload.' }, { status: 400 });
  }

  const result = await reorderPresentationOrder(sessionId, parsed.data.orderedGroupIds);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ groups: result.groups });
}
