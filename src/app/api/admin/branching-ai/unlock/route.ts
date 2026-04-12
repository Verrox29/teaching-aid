import { NextResponse } from 'next/server';
import { z } from 'zod';

import { unlockBranchingAiAdmin } from '@/lib/ai/admin-auth';

const requestSchema = z.object({
  token: z.string().min(1)
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid unlock payload.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await unlockBranchingAiAdmin(parsed.data.token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not unlock Branching AI.';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
