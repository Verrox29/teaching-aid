import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  buildChallengeQuestions,
  buildEvaluationRecommendations,
  formatFeedbackSections,
  getEvaluationLanguage
} from '@/lib/evaluation/engine';
import { getSessionExportMetadataRecord } from '@/lib/exports/repository';
import {
  getEvaluationWorkspace,
  saveEvaluationAiResult,
  saveEvaluationDraft
} from '@/lib/evaluation/repository';

const requestSchema = z.object({
  mode: z.enum(['grading', 'questions'])
});

type RouteParams = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { sessionId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid batch AI request.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const workspace = await getEvaluationWorkspace(sessionId);
    const metadata = await getSessionExportMetadataRecord(sessionId, workspace.session.title);
    const language = getEvaluationLanguage(workspace.session.language);
    const mode = parsed.data.mode;
    const skipped: Array<{ groupId: string; groupName: string; reason: string }> = [];

    for (const group of workspace.groups) {
      if (mode === 'questions') {
        if (!group.submissionId || !group.submissionContent?.trim()) {
          skipped.push({
            groupId: group.groupId,
            groupName: group.groupName,
            reason: 'No uploaded work available.'
          });
          continue;
        }

        const challengeQuestions = buildChallengeQuestions(
          {
            className: metadata.className || workspace.session.title,
            groupName: group.groupName,
            sessionLanguage: workspace.session.language,
            submissionContent: group.submissionContent,
            submissionTitle: group.submissionTitle ?? workspace.session.title,
            subject: metadata.subject || workspace.session.title
          },
          language
        );

        await saveEvaluationAiResult({
          aiGeneratedAt: new Date(),
          aiRecommendedQuestions: challengeQuestions,
          groupId: group.groupId,
          sessionId
        });
        continue;
      }

      if (!group.presentationComments.trim()) {
        skipped.push({
          groupId: group.groupId,
          groupName: group.groupName,
          reason: 'Presentation comments are required.'
        });
        continue;
      }

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
        groupId: group.groupId,
        sessionId
      });

      await saveEvaluationDraft(sessionId, group.groupId, {
        finalFeedback: formatFeedbackSections(result.feedback, workspace.session.language)
      });
    }

    const refreshed = await getEvaluationWorkspace(sessionId);

    return NextResponse.json({
      groups: refreshed.groups,
      mode,
      skipped
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not run batch AI.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
