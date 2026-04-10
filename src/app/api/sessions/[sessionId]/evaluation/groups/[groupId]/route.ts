import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  finalizeEvaluationGroup,
  getEvaluationGroupWorkspace,
  getEvaluationWorkspace,
  saveEvaluationDraft
} from '@/lib/evaluation/repository';

const scoreSchema = z.object({
  criterionId: z.string().uuid(),
  feedback: z.string().nullable().optional(),
  score: z.coerce.number().int().min(0)
});

const saveSchema = z.object({
  finalFeedback: z.string().nullable().optional(),
  presentationComments: z.string().nullable().optional(),
  qaComments: z.string().nullable().optional(),
  scores: z.array(scoreSchema).optional()
});

const finalizeSchema = z.object({
  action: z.literal('finalize')
});

type RouteParams = {
  params: Promise<{ groupId: string; sessionId: string }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { groupId, sessionId } = await params;
  const parsed = saveSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid evaluation payload.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const evaluationWorkspace = await getEvaluationWorkspace(sessionId);
    const group = evaluationWorkspace.groups.find((entry) => entry.groupId === groupId);
    if (!group) {
      return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
    }

    if (parsed.data.scores) {
      const maxScoreByCriterionId = new Map(
        group.criteria.map((criterion) => [criterion.id, criterion.maxScore])
      );

      for (const score of parsed.data.scores) {
        const maxScore = maxScoreByCriterionId.get(score.criterionId);
        if (typeof maxScore !== 'number') {
          return NextResponse.json(
            { error: 'One or more submitted criteria do not belong to this rubric.' },
            { status: 400 }
          );
        }

        if (score.score > maxScore) {
          return NextResponse.json(
            { error: `Score for one criterion exceeds the maximum of ${maxScore}.` },
            { status: 400 }
          );
        }
      }
    }

    await saveEvaluationDraft(sessionId, groupId, parsed.data);
    const refreshedGroup = await getEvaluationGroupWorkspace(sessionId, groupId);
    return NextResponse.json({ group: refreshedGroup });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save evaluation.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { groupId, sessionId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = finalizeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await finalizeEvaluationGroup(sessionId, groupId);
    const workspace = await getEvaluationGroupWorkspace(sessionId, groupId);
    return NextResponse.json({ group: workspace });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not finalize evaluation.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
