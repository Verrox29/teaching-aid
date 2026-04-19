import { NextResponse } from 'next/server';

import { randomizePresentationOrder } from '@/app/sessions/[sessionId]/order/presentation-order';

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const { sessionId } = await params;
  const result = await randomizePresentationOrder(sessionId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ groups: result.groups });
}
