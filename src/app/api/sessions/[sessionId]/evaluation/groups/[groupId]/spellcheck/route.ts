import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cleanupFeedbackSections, formatFeedbackSections } from '@/lib/evaluation/engine';
import { getEvaluationWorkspace } from '@/lib/evaluation/repository';

const sectionsSchema = z.object({
  development: z.string().optional(),
  general: z.string().optional(),
  strengths: z.string().optional()
});

const requestSchema = z.object({
  sections: sectionsSchema
});

type RouteParams = {
  params: Promise<{ groupId: string; sessionId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { groupId, sessionId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid spell-check payload.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const workspace = await getEvaluationWorkspace(sessionId);
    const group = workspace.groups.find((entry) => entry.groupId === groupId);
    if (!group) {
      throw new Error('Group not found.');
    }
    const cleaned = cleanupFeedbackSections(
      {
        development: parsed.data.sections.development ?? '',
        general: parsed.data.sections.general ?? '',
        strengths: parsed.data.sections.strengths ?? ''
      },
      workspace.session.language
    );

    return NextResponse.json({
      combined: formatFeedbackSections(cleaned, workspace.session.language),
      sections: cleaned
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not spell-check feedback.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
