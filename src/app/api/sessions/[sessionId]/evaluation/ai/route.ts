import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  buildChallengeQuestions,
  formatFeedbackSections,
  getEvaluationLanguage
} from '@/lib/evaluation/engine';
import { derivePeerQuestionsObserved, generateBranchingAiGradingRecommendations } from '@/lib/ai';
import { db, sessions } from '@/db';
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

      if (!group.presentationComments.trim() && !group.submissionContent?.trim()) {
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
        submissionContent: group.submissionContent,
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
