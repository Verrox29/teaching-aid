import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  buildChallengeQuestions,
  getEvaluationLanguage
} from '@/lib/evaluation/engine';
import { generateBranchingAiGradingRecommendations } from '@/lib/ai';
import {
  getEvaluationContext,
  getEvaluationWorkspace,
  saveEvaluationAiResult,
  saveEvaluationDraft,
  setEvaluationAiStatus
} from '@/lib/evaluation/repository';
import { formatFeedbackSections } from '@/lib/evaluation/engine';
import { getSessionExportMetadataRecord } from '@/lib/exports/repository';

const requestSchema = z.object({
  mode: z.enum(['grading', 'questions']).default('grading')
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
      { error: 'Invalid AI request.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const context = await getEvaluationContext(sessionId, groupId);
    const metadata = await getSessionExportMetadataRecord(sessionId, context.session.title);
    const mode = parsed.data.mode;
    const hasTeacherComments = Boolean(context.evaluation?.presentationComments?.trim());
    const hasSubmissionContent = Boolean(context.submission?.content?.trim());

    if (mode === 'grading' && !hasTeacherComments && !hasSubmissionContent) {
      throw new Error('Enter comments or upload work before generating AI feedback and grades.');
    }

    await setEvaluationAiStatus(sessionId, groupId, 'generating');

    if (mode === 'questions') {
      const language = getEvaluationLanguage(context.session.language);
      const challengeQuestions = buildChallengeQuestions(
        {
          className: metadata.className || context.session.title,
          groupName: context.group.name,
          sessionLanguage: context.session.language,
          submissionContent: context.submission.content,
          submissionTitle: context.submission.title,
          subject: metadata.subject || context.session.title
        },
        language
      );

      await saveEvaluationAiResult({
        aiGeneratedAt: new Date(),
        aiRecommendedQuestions: challengeQuestions,
        groupId,
        sessionId
      });
    } else {
      const result = await generateBranchingAiGradingRecommendations({
        className: metadata.className || context.session.title,
        criteria: context.rubric.criteria,
        groupName: context.group.name,
        presentationComments: context.evaluation?.presentationComments ?? '',
        peerQuestionsObserved: context.evaluation?.comments ?? '',
        qaComments: context.evaluation?.comments ?? '',
        rubric: context.rubric,
        submissionContent: context.submission?.content ?? null,
        submissionTitle: context.submission?.title ?? null,
        sessionLanguage: context.session.language,
        subject: metadata.subject || context.session.title
      });

      await saveEvaluationAiResult({
        aiGeneratedAt: new Date(),
        aiRecommendedCriteria: result.recommendedCriteria,
        aiRecommendedFeedback: result.feedback,
        groupId,
        sessionId
      });

      await saveEvaluationDraft(sessionId, groupId, {
        finalFeedback: formatFeedbackSections(result.feedback, context.session.language)
      });
    }

    const refreshed = await getEvaluationWorkspace(sessionId);
    const refreshedGroup = refreshed.groups.find((entry) => entry.groupId === groupId) ?? null;
    return NextResponse.json({
      ai:
        mode === 'questions'
          ? { challengeQuestions: refreshedGroup?.aiRecommendedQuestions ?? [] }
          : {
              feedback: refreshedGroup?.aiRecommendedFeedback ?? null,
              recommendedCriteria: refreshedGroup?.aiRecommendedCriteria ?? []
            },
      group: refreshedGroup
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not generate AI recommendations.';
    await setEvaluationAiStatus(sessionId, groupId, 'failed', message).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
