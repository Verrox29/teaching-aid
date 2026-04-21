import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  derivePeerQuestionsObserved,
  generateBranchingAiChallengeQuestions,
  generateBranchingAiGradingRecommendations,
  saveBranchingAiLatestQuestionRejectionReasons
} from '@/lib/ai';
import { db, sessions } from '@/db';
import {
  getEvaluationContext,
  getEvaluationWorkspace,
  resetEvaluationAiQuestions,
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

function buildSessionContextSummary(params: {
  className: string;
  instructions: string | null;
  metadata: {
    className: string;
    professorName: string;
    programme: string;
    season: string;
    sessionDate: string;
    subject: string;
  };
  sessionLanguage: string;
  sessionTitle: string;
}) {
  return [
    `Session title: ${params.sessionTitle}`,
    `Session language: ${params.sessionLanguage}`,
    `Class name: ${params.metadata.className || params.className || params.sessionTitle}`,
    `Subject: ${params.metadata.subject || params.sessionTitle}`,
    `Programme: ${params.metadata.programme || 'Not provided'}`,
    `Season: ${params.metadata.season || 'Not provided'}`,
    `Professor: ${params.metadata.professorName || 'Not provided'}`,
    `Session date: ${params.metadata.sessionDate || 'Not provided'}`,
    `Project brief: ${params.instructions?.trim() || 'Not provided'}`
  ].join('\n');
}

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
    const sessionRows = await db
      .select({
        instructions: sessions.instructions,
        title: sessions.title
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    const sessionRecord = sessionRows[0] ?? null;
    const mode = parsed.data.mode;
    const hasTeacherComments = Boolean(context.evaluation?.presentationComments?.trim());
    const hasSubmissionContent = Boolean(context.submission?.content?.trim());
    let challengeQuestionsResult: Awaited<
      ReturnType<typeof generateBranchingAiChallengeQuestions>
    > | null = null;
    let gradingResult: Awaited<ReturnType<typeof generateBranchingAiGradingRecommendations>> | null =
      null;

    if (mode === 'grading' && !hasTeacherComments && !hasSubmissionContent) {
      throw new Error('Enter comments or upload work before generating AI feedback and grades.');
    }

    if (mode === 'questions') {
      await resetEvaluationAiQuestions(sessionId, groupId);
      challengeQuestionsResult = await generateBranchingAiChallengeQuestions(
        {
          assignmentBrief: sessionRecord?.instructions?.trim() || '',
          className: metadata.className || context.session.title,
          evaluationCriteria: context.rubric?.criteria ?? [],
          groupName: context.group.name,
          presentationContent: context.evaluation?.presentationComments ?? '',
          sessionContext: buildSessionContextSummary({
            className: metadata.className || context.session.title,
            instructions: sessionRecord?.instructions ?? null,
            metadata,
            sessionLanguage: context.session.language,
            sessionTitle: sessionRecord?.title ?? context.session.title
          }),
          sessionLanguage: context.session.language,
          submissionText: context.submissionText,
          subject: metadata.subject || context.session.title
        }
      );

      await saveEvaluationAiResult({
        aiGeneratedAt: new Date(),
        aiLastError: challengeQuestionsResult.diagnostics.fallbackReason,
        aiRecommendedQuestions: challengeQuestionsResult.questions,
        groupId,
        sessionId
      });
      await saveBranchingAiLatestQuestionRejectionReasons(
        challengeQuestionsResult.debug?.questionRejectionReasons ?? null
      );
    } else {
      await setEvaluationAiStatus(sessionId, groupId, 'generating');
      gradingResult = await generateBranchingAiGradingRecommendations({
        className: metadata.className || context.session.title,
        criteria: context.rubric.criteria,
        groupName: context.group.name,
        presentationComments: context.evaluation?.presentationComments ?? '',
        peerQuestionsObserved: derivePeerQuestionsObserved(context.evaluation?.comments ?? ''),
        qaComments: context.evaluation?.comments ?? '',
        rubric: context.rubric,
        sessionContext: buildSessionContextSummary({
          className: metadata.className || context.session.title,
          instructions: sessionRecord?.instructions ?? null,
          metadata,
          sessionLanguage: context.session.language,
          sessionTitle: sessionRecord?.title ?? context.session.title
        }),
        submissionContent: context.submission?.content ?? null,
        submissionTitle: context.submission?.title ?? null,
        sessionLanguage: context.session.language,
        subject: metadata.subject || context.session.title
      });

      await saveEvaluationAiResult({
        aiGeneratedAt: new Date(),
        aiLastError: gradingResult.diagnostics.fallbackReason,
        aiRecommendedCriteria: gradingResult.recommendedCriteria,
        aiRecommendedFeedback: gradingResult.feedback,
        groupId,
        sessionId
      });

      await saveEvaluationDraft(sessionId, groupId, {
        finalFeedback: formatFeedbackSections(gradingResult.feedback, context.session.language)
      });
    }

    const refreshed = await getEvaluationWorkspace(sessionId);
    const refreshedGroup = refreshed.groups.find((entry) => entry.groupId === groupId) ?? null;
    const challengeQuestionsDebug =
      mode === 'questions' && process.env.NODE_ENV !== 'production'
        ? challengeQuestionsResult?.debug ?? null
        : null;
    return NextResponse.json({
      ai:
        mode === 'questions'
          ? {
              challengeQuestions: {
                debug: challengeQuestionsDebug,
                questions: refreshedGroup?.aiRecommendedQuestions ?? []
              }
            }
          : {
              feedback: refreshedGroup?.aiRecommendedFeedback ?? null,
              recommendedCriteria: refreshedGroup?.aiRecommendedCriteria ?? [],
              recommendedTotalScore: gradingResult?.recommendedTotalScore ?? null
            },
      group: refreshedGroup
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not generate AI recommendations.';
    await setEvaluationAiStatus(sessionId, groupId, 'failed', message).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
