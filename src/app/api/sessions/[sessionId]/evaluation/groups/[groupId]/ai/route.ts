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

const MIN_CHALLENGE_QUESTION_SOURCE_WORDS = 30;

function countGroundingWords(value: string) {
  return value
    .split(/\s+/g)
    .map((entry) => entry.trim())
    .filter((entry) => /[A-Za-zÀ-ÿ]/.test(entry)).length;
}

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
    const hasSubmissionContent = Boolean(context.submissionText?.trim());
    let challengeQuestionsResult: Awaited<
      ReturnType<typeof generateBranchingAiChallengeQuestions>
    > | null = null;
    let gradingResult: Awaited<ReturnType<typeof generateBranchingAiGradingRecommendations>> | null =
      null;

    if (mode === 'grading' && !hasTeacherComments && !hasSubmissionContent) {
      throw new Error('Enter comments or upload work before generating AI feedback and grades.');
    }

    if (mode === 'questions') {
      if (!context.submission?.id) {
        throw new Error('Upload work for this group before generating challenge questions.');
      }

      const submissionText = context.submissionText?.trim() ?? '';
      if (!submissionText) {
        const fileLabel = context.submission?.title ?? 'this uploaded file';
        if (context.submissionTextIssue === 'image_only_or_ocr_required') {
          throw new Error(
            `The uploaded file "${fileLabel}" appears to be image-only/scanned. OCR is required before Challenge Questions can be generated from it.`
          );
        }
        throw new Error(
          `Could not read usable text from "${fileLabel}".`
        );
      }
      const sourceWordCount = countGroundingWords(submissionText);
      if (sourceWordCount < MIN_CHALLENGE_QUESTION_SOURCE_WORDS) {
        throw new Error(
          `The uploaded file "${context.submission?.title ?? 'this uploaded file'}" has only ${sourceWordCount} readable words. At least ${MIN_CHALLENGE_QUESTION_SOURCE_WORDS} readable words are required for grounded challenge questions.`
        );
      }

      const previousQuestions = context.evaluation?.aiRecommendedQuestions ?? [];
      const regenerationAttempt = Date.now();
      await resetEvaluationAiQuestions(sessionId, groupId);
      challengeQuestionsResult = await generateBranchingAiChallengeQuestions(
        {
          assignmentBrief: sessionRecord?.instructions?.trim() || '',
          className: metadata.className || context.session.title,
          evaluationCriteria: context.rubric?.criteria ?? [],
          groupName: context.group.name,
          previousQuestions,
          presentationContent: submissionText,
          regenerationAttempt,
          sessionContext: buildSessionContextSummary({
            className: metadata.className || context.session.title,
            instructions: sessionRecord?.instructions ?? null,
            metadata,
            sessionLanguage: context.session.language,
            sessionTitle: sessionRecord?.title ?? context.session.title
          }),
          sessionLanguage: context.session.language,
          submissionText,
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
        submissionContent: context.submissionText ?? null,
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
