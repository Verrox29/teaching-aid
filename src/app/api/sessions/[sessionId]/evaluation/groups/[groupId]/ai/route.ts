import { NextResponse } from 'next/server';

import { buildEvaluationRecommendations } from '@/lib/evaluation/engine';
import {
  getEvaluationWorkspace,
  saveEvaluationAiResult,
  setEvaluationAiStatus
} from '@/lib/evaluation/repository';
import { getSessionExportMetadataRecord } from '@/lib/exports/repository';

type RouteParams = {
  params: Promise<{ groupId: string; sessionId: string }>;
};

export async function POST(_request: Request, { params }: RouteParams) {
  const { groupId, sessionId } = await params;

  try {
    await setEvaluationAiStatus(sessionId, groupId, 'generating');
    const workspace = await getEvaluationWorkspace(sessionId);
    const group = workspace.groups.find((entry) => entry.groupId === groupId);

    if (!group) {
      throw new Error('Group not found.');
    }

    const metadata = await getSessionExportMetadataRecord(sessionId, workspace.session.title);
    const result = buildEvaluationRecommendations({
      className: metadata.className || workspace.session.title,
      criteria: group.criteria,
      groupName: group.groupName,
      presentationComments: group.presentationComments,
      qaComments: group.qaComments,
      sessionLanguage: workspace.session.language,
      subject: metadata.subject || workspace.session.title
    });

    await saveEvaluationAiResult({
      aiGeneratedAt: new Date(),
      aiRecommendedCriteria: result.recommendedCriteria,
      aiRecommendedFeedback: result.feedback,
      aiRecommendedQuestions: result.challengeQuestions,
      groupId,
      sessionId
    });

    const refreshed = await getEvaluationWorkspace(sessionId);
    const refreshedGroup = refreshed.groups.find((entry) => entry.groupId === groupId) ?? null;

    return NextResponse.json({ ai: result, group: refreshedGroup });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not generate AI recommendations.';
    await setEvaluationAiStatus(sessionId, groupId, 'failed', message).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
