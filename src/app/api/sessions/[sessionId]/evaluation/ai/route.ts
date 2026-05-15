import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { formatFeedbackSections } from '@/lib/evaluation/engine';
import {
  derivePeerQuestionsObserved,
  generateBranchingAiChallengeQuestions,
  generateBranchingAiGradingRecommendations,
  saveBranchingAiLatestQuestionRejectionReasons
} from '@/lib/ai';
import { db, sessions } from '@/db';
import { getSessionExportMetadataRecord } from '@/lib/exports/repository';
import {
  getEvaluationWorkspace,
  resetEvaluationAiQuestions,
  saveEvaluationAiResult,
  saveEvaluationDraft
} from '@/lib/evaluation/repository';

const requestSchema = z.object({
  mode: z.enum(['grading', 'questions'])
});

type RouteParams = {
  params: Promise<{ sessionId: string }>;
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
    const skipped: Array<{ groupId: string; groupName: string; reason: string }> = [];
    const batchCooldownMs = mode === 'grading' ? 2000 : 750;

    for (const [index, group] of workspace.groups.entries()) {
      if (mode === 'questions') {
        if (!group.submissionId) {
          skipped.push({
            groupId: group.groupId,
            groupName: group.groupName,
            reason: 'No uploaded work available.'
          });
          continue;
        }

        const submissionText = group.submissionText?.trim() ?? '';
        if (!submissionText) {
          const fileLabel = group.submissionTitle ?? 'the uploaded file';
          skipped.push({
            groupId: group.groupId,
            groupName: group.groupName,
            reason:
              group.submissionTextIssue === 'image_only_or_ocr_required'
                ? `"${fileLabel}" appears to be image-only/scanned and requires OCR before Challenge Questions can be generated.`
                : `Could not read usable text from "${fileLabel}".`
          });
          continue;
        }

        const sourceWordCount = countGroundingWords(submissionText);
        if (sourceWordCount < MIN_CHALLENGE_QUESTION_SOURCE_WORDS) {
          skipped.push({
            groupId: group.groupId,
            groupName: group.groupName,
            reason: `"${group.submissionTitle ?? 'Uploaded file'}" has only ${sourceWordCount} readable words (minimum ${MIN_CHALLENGE_QUESTION_SOURCE_WORDS}).`
          });
          continue;
        }

        await resetEvaluationAiQuestions(sessionId, group.groupId);
        const challengeQuestionsResult = await generateBranchingAiChallengeQuestions(
          {
            assignmentBrief: sessionRecord?.instructions?.trim() || '',
            className: metadata.className || workspace.session.title,
            evaluationCriteria: workspace.rubric?.criteria ?? [],
            groupName: group.groupName,
            presentationContent: submissionText,
            sessionContext: buildSessionContextSummary({
              className: metadata.className || workspace.session.title,
              instructions: sessionRecord?.instructions ?? null,
              metadata,
              sessionLanguage: workspace.session.language,
              sessionTitle: sessionRecord?.title ?? workspace.session.title
            }),
            sessionLanguage: workspace.session.language,
            submissionText,
            subject: metadata.subject || workspace.session.title
          }
        );

        await saveEvaluationAiResult({
          aiGeneratedAt: new Date(),
          aiLastError: challengeQuestionsResult.diagnostics.fallbackReason,
          aiRecommendedQuestions: challengeQuestionsResult.questions,
          groupId: group.groupId,
          sessionId
        });
        await saveBranchingAiLatestQuestionRejectionReasons(
          challengeQuestionsResult.debug?.questionRejectionReasons ?? null
        );
        if (index < workspace.groups.length - 1) {
          await sleep(batchCooldownMs);
        }
        continue;
      }

      if (!group.presentationComments.trim() && !group.submissionText?.trim()) {
        skipped.push({
          groupId: group.groupId,
          groupName: group.groupName,
          reason: 'Add comments or upload work first.'
        });
        continue;
      }

      const result = await generateBranchingAiGradingRecommendations({
        className: metadata.className || workspace.session.title,
        criteria: group.criteria,
        groupName: group.groupName,
        presentationComments: group.presentationComments,
        peerQuestionsObserved: derivePeerQuestionsObserved(group.qaComments),
        qaComments: group.qaComments,
        rubric: workspace.rubric,
        sessionContext: buildSessionContextSummary({
          className: metadata.className || workspace.session.title,
          instructions: sessionRecord?.instructions ?? null,
          metadata,
          sessionLanguage: workspace.session.language,
          sessionTitle: sessionRecord?.title ?? workspace.session.title
        }),
        submissionContent: group.submissionText,
        submissionTitle: group.submissionTitle,
        sessionLanguage: workspace.session.language,
        subject: metadata.subject || workspace.session.title
      });

      await saveEvaluationAiResult({
        aiGeneratedAt: new Date(),
        aiLastError: result.diagnostics.fallbackReason,
        aiRecommendedCriteria: result.recommendedCriteria,
        aiRecommendedFeedback: result.feedback,
        groupId: group.groupId,
        sessionId
      });

      await saveEvaluationDraft(sessionId, group.groupId, {
        finalFeedback: formatFeedbackSections(result.feedback, workspace.session.language)
      });

      if (index < workspace.groups.length - 1) {
        await sleep(batchCooldownMs);
      }
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
