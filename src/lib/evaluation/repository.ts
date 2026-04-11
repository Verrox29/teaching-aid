import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import {
  db,
  evaluationScores,
  evaluations,
  groupMembers,
  groups,
  sessionStudents,
  sessions,
  submissions
} from '@/db';

import { parseFeedbackSections } from './engine';
import { ensurePairagogieRubric } from './rubric';
import type {
  EvaluationAiCriterionRecommendation,
  EvaluationAiFeedbackSections,
  EvaluationAiStatus,
  EvaluationCriterionRow,
  EvaluationGroupWorkspace,
  EvaluationSavePayload,
  EvaluationWorkspace
} from './types';

type EvaluationRow = {
  aiGeneratedAt: Date | null;
  aiLastError: string | null;
  aiRecommendedCriteria: EvaluationAiCriterionRecommendation[] | null;
  aiRecommendedFeedback: EvaluationAiFeedbackSections | null;
  aiRecommendedQuestions: string[] | null;
  aiStatus: EvaluationAiStatus;
  aiStatusUpdatedAt: Date | null;
  comments: string | null;
  evaluatorGroupId: string;
  finalFeedback: string | null;
  id: string;
  presentationComments: string | null;
  submittedAt: Date | null;
  submissionId: string;
  teacherNotes: string | null;
  updatedAt: Date;
};

type EvaluationScoreRow = {
  evaluationId: string;
  feedback: string | null;
  rubricCriterionId: string;
  score: number;
};

type EvaluationWorkspaceQueryGroup = {
  capacity: number;
  createdAt: Date;
  id: string;
  name: string;
  presentationOrder: number | null;
};

type EvaluationWorkspaceSessionRow = {
  id: string;
  language: string;
  slug: string;
  title: string;
};

function sortGroups(groupsToSort: EvaluationWorkspaceQueryGroup[]) {
  return [...groupsToSort].sort((left, right) => {
    const leftOrder = left.presentationOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.presentationOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

function computeReadyForFinalization(
  presentationComments: string,
  finalFeedbackSections: EvaluationAiFeedbackSections,
  criteria: EvaluationCriterionRow[]
) {
  return Boolean(
    presentationComments.trim() &&
      finalFeedbackSections.strengths.trim() &&
      finalFeedbackSections.development.trim() &&
      finalFeedbackSections.general.trim() &&
      criteria.length > 0 &&
      criteria.every((criterion) => criterion.score !== null)
  );
}

async function getSessionRecord(sessionId: string): Promise<EvaluationWorkspaceSessionRow | null> {
  const rows = await db
    .select({
      id: sessions.id,
      language: sessions.language,
      slug: sessions.slug,
      title: sessions.title
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return rows[0] ?? null;
}

async function getRubricSnapshot(sessionId: string) {
  const rubric = await ensurePairagogieRubric(sessionId);

  return {
    criteria: rubric.criteria.map((criterion) => ({
      description: criterion.description,
      feedback: null,
      id: criterion.id,
      label: criterion.label,
      maxScore: criterion.maxScore,
      score: null,
      sortOrder: criterion.sortOrder
    })) satisfies EvaluationCriterionRow[],
    id: rubric.id,
    title: rubric.title
  };
}

async function getGroupMembers(sessionId: string) {
  const memberRows = await db
    .select({
      firstName: sessionStudents.firstName,
      groupId: groupMembers.groupId,
      id: sessionStudents.id,
      lastName: sessionStudents.lastName,
      schoolEmail: sessionStudents.schoolEmail
    })
    .from(groupMembers)
    .innerJoin(sessionStudents, eq(groupMembers.sessionStudentId, sessionStudents.id))
    .where(eq(groupMembers.sessionId, sessionId))
    .orderBy(asc(sessionStudents.lastName), asc(sessionStudents.firstName));

  const membersByGroupId = new Map<
    string,
    Array<{
      firstName: string;
      id: string;
      lastName: string;
      schoolEmail: string;
    }>
  >();

  for (const member of memberRows) {
    const members = membersByGroupId.get(member.groupId) ?? [];
    members.push({
      firstName: member.firstName,
      id: member.id,
      lastName: member.lastName,
      schoolEmail: member.schoolEmail
    });
    membersByGroupId.set(member.groupId, members);
  }

  return membersByGroupId;
}

async function getSubmissions(sessionId: string) {
  return db
    .select({
      content: submissions.content,
      groupId: submissions.groupId,
      id: submissions.id,
      submittedAt: submissions.submittedAt,
      title: submissions.title
    })
    .from(submissions)
    .where(eq(submissions.sessionId, sessionId));
}

async function getEvaluationRows(sessionId: string) {
  const rows = await db
    .select({
      aiGeneratedAt: evaluations.aiGeneratedAt,
      aiLastError: evaluations.aiLastError,
      aiRecommendedCriteria: evaluations.aiRecommendedCriteria,
      aiRecommendedFeedback: evaluations.aiRecommendedFeedback,
      aiRecommendedQuestions: evaluations.aiRecommendedQuestions,
      aiStatus: evaluations.aiStatus,
      aiStatusUpdatedAt: evaluations.aiStatusUpdatedAt,
      comments: evaluations.comments,
      evaluatorGroupId: evaluations.evaluatorGroupId,
      finalFeedback: evaluations.finalFeedback,
      id: evaluations.id,
      presentationComments: evaluations.teacherNotes,
      submittedAt: evaluations.submittedAt,
      submissionId: evaluations.submissionId,
      teacherNotes: evaluations.teacherNotes,
      updatedAt: evaluations.updatedAt
    })
    .from(evaluations)
    .where(eq(evaluations.sessionId, sessionId))
    .orderBy(desc(evaluations.updatedAt));

  return rows as EvaluationRow[];
}

async function getEvaluationScoreRows(evaluationIds: string[]) {
  if (evaluationIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      evaluationId: evaluationScores.evaluationId,
      feedback: evaluationScores.feedback,
      rubricCriterionId: evaluationScores.rubricCriterionId,
      score: evaluationScores.score
    })
    .from(evaluationScores)
    .where(inArray(evaluationScores.evaluationId, evaluationIds));

  return rows as EvaluationScoreRow[];
}

function buildGroupWorkspace(params: {
  group: EvaluationWorkspaceQueryGroup;
  membersByGroupId: Map<string, EvaluationGroupWorkspace['members']>;
  evaluationByGroupKey: Map<string, EvaluationRow>;
  rubric: Awaited<ReturnType<typeof getRubricSnapshot>>;
  scoreRowsByEvaluationId: Map<string, EvaluationScoreRow[]>;
  sessionLanguage: string;
  submissionByGroupId: Map<
    string,
    { content: string | null; groupId: string; id: string; submittedAt: Date | null; title: string }
  >;
}) {
  const {
    group,
    membersByGroupId,
    evaluationByGroupKey,
    rubric,
    scoreRowsByEvaluationId,
    sessionLanguage,
    submissionByGroupId
  } = params;
  const submission = submissionByGroupId.get(group.id) ?? null;
  const evaluation = submission ? evaluationByGroupKey.get(`${submission.id}:${group.id}`) ?? null : null;
  const scoreRows = evaluation ? scoreRowsByEvaluationId.get(evaluation.id) ?? [] : [];
  const criteria = rubric?.criteria ?? [];

  const criteriaWithScores = criteria.map((criterion) => {
    const scoreRow = scoreRows.find((row) => row.rubricCriterionId === criterion.id) ?? null;
    return {
      ...criterion,
      feedback: scoreRow?.feedback ?? criterion.feedback ?? null,
      score: scoreRow?.score ?? null
    };
  });

  const presentationComments = evaluation?.presentationComments ?? '';
  const finalFeedback = evaluation?.finalFeedback ?? '';
  const qaComments = evaluation?.comments ?? '';
  const finalFeedbackSections = parseFeedbackSections(finalFeedback, sessionLanguage);
  const totalScore = scoreRows.length > 0 ? scoreRows.reduce((sum, row) => sum + row.score, 0) : null;

  return {
    aiGeneratedAt: evaluation?.aiGeneratedAt ?? null,
    aiLastError: evaluation?.aiLastError ?? null,
    aiRecommendedCriteria: evaluation?.aiRecommendedCriteria ?? [],
    aiRecommendedFeedback: evaluation?.aiRecommendedFeedback ?? null,
    aiRecommendedQuestions: evaluation?.aiRecommendedQuestions ?? [],
    aiStatus: evaluation?.aiStatus ?? 'idle',
    aiStatusUpdatedAt: evaluation?.aiStatusUpdatedAt ?? null,
    criteria: criteriaWithScores,
    evaluationId: evaluation?.id ?? null,
    finalFeedback,
    finalFeedbackSections,
    groupId: group.id,
    groupName: group.name,
    members: membersByGroupId.get(group.id) ?? [],
    presentationComments,
    presentationOrder: group.presentationOrder,
    qaComments,
    readyForFinalization: computeReadyForFinalization(
      presentationComments,
      finalFeedbackSections,
      criteriaWithScores
    ),
    submittedAt: evaluation?.submittedAt ?? null,
    submissionId: submission?.id ?? null,
    submissionContent: submission?.content ?? null,
    submissionTitle: submission?.title ?? null,
    totalScore
  };
}

export async function getEvaluationWorkspace(sessionId: string): Promise<EvaluationWorkspace> {
  const session = await getSessionRecord(sessionId);
  if (!session) {
    throw new Error('Session not found.');
  }

  const rubric = await getRubricSnapshot(sessionId);
  const groupsRows = await db
    .select({
      capacity: groups.capacity,
      createdAt: groups.createdAt,
      id: groups.id,
      name: groups.name,
      presentationOrder: groups.presentationOrder
    })
    .from(groups)
    .where(eq(groups.sessionId, sessionId))
    .orderBy(asc(groups.createdAt));

  const submissionsRows = await getSubmissions(sessionId);
  const evaluationsRows = await getEvaluationRows(sessionId);
  const scoreRows = await getEvaluationScoreRows(evaluationsRows.map((evaluation) => evaluation.id));

  const submissionByGroupId = new Map(submissionsRows.map((submission) => [submission.groupId, submission]));
  const evaluationByGroupKey = new Map(
    evaluationsRows.map((evaluation) => [`${evaluation.submissionId}:${evaluation.evaluatorGroupId}`, evaluation])
  );
  const scoreRowsByEvaluationId = new Map<string, EvaluationScoreRow[]>();
  for (const scoreRow of scoreRows) {
    const current = scoreRowsByEvaluationId.get(scoreRow.evaluationId) ?? [];
    current.push(scoreRow);
    scoreRowsByEvaluationId.set(scoreRow.evaluationId, current);
  }
  const membersByGroupId = await getGroupMembers(sessionId);

  return {
    groups: sortGroups(groupsRows).map((group) =>
      buildGroupWorkspace({
        evaluationByGroupKey,
        group,
        membersByGroupId,
        rubric,
        scoreRowsByEvaluationId,
        sessionLanguage: session.language,
        submissionByGroupId
      })
    ),
    rubric,
    session
  };
}

export async function getEvaluationGroupWorkspace(sessionId: string, groupId: string) {
  const workspace = await getEvaluationWorkspace(sessionId);
  const group = workspace.groups.find((entry) => entry.groupId === groupId) ?? null;
  if (!group) {
    throw new Error('Group not found.');
  }

  return group;
}

export async function getEvaluationContext(sessionId: string, groupId: string) {
  const session = await getSessionRecord(sessionId);
  if (!session) {
    throw new Error('Session not found.');
  }

  const rubric = await getRubricSnapshot(sessionId);
  if (!rubric) {
    throw new Error('No active rubric found.');
  }

  const groupRows = await db
    .select({
      createdAt: groups.createdAt,
      id: groups.id,
      name: groups.name,
      presentationOrder: groups.presentationOrder
    })
    .from(groups)
    .where(and(eq(groups.sessionId, sessionId), eq(groups.id, groupId)))
    .limit(1);

  const group = groupRows[0] ?? null;
  if (!group) {
    throw new Error('Group not found.');
  }

  const submissionRows = await db
    .select({
      content: submissions.content,
      id: submissions.id,
      submittedAt: submissions.submittedAt,
      title: submissions.title
    })
    .from(submissions)
    .where(and(eq(submissions.sessionId, sessionId), eq(submissions.groupId, groupId)))
    .limit(1);

  const submission = submissionRows[0] ?? null;
  if (!submission) {
    throw new Error('Upload a submission before evaluating this group.');
  }

  const evaluationRows = await db
    .select({
      aiGeneratedAt: evaluations.aiGeneratedAt,
      aiLastError: evaluations.aiLastError,
      aiRecommendedCriteria: evaluations.aiRecommendedCriteria,
      aiRecommendedFeedback: evaluations.aiRecommendedFeedback,
      aiRecommendedQuestions: evaluations.aiRecommendedQuestions,
      aiStatus: evaluations.aiStatus,
      aiStatusUpdatedAt: evaluations.aiStatusUpdatedAt,
      comments: evaluations.comments,
      evaluatorGroupId: evaluations.evaluatorGroupId,
      finalFeedback: evaluations.finalFeedback,
      id: evaluations.id,
      presentationComments: evaluations.teacherNotes,
      submittedAt: evaluations.submittedAt,
      submissionId: evaluations.submissionId,
      teacherNotes: evaluations.teacherNotes,
      updatedAt: evaluations.updatedAt
    })
    .from(evaluations)
    .where(
      and(
        eq(evaluations.sessionId, sessionId),
        eq(evaluations.submissionId, submission.id),
        eq(evaluations.evaluatorGroupId, groupId)
      )
    )
    .orderBy(desc(evaluations.updatedAt))
    .limit(1);

  const evaluation = (evaluationRows as EvaluationRow[])[0] ?? null;
  const scoreRows = evaluation
    ? ((await db
        .select({
          feedback: evaluationScores.feedback,
          rubricCriterionId: evaluationScores.rubricCriterionId,
          score: evaluationScores.score
        })
        .from(evaluationScores)
        .where(eq(evaluationScores.evaluationId, evaluation.id))) as EvaluationScoreRow[])
    : [];

  return {
    evaluation,
    group,
    rubric,
    scoreRows,
    session,
    submission
  };
}

export async function saveEvaluationDraft(
  sessionId: string,
  groupId: string,
  payload: EvaluationSavePayload
) {
  const context = await getEvaluationContext(sessionId, groupId);
  const now = new Date();
  const presentationComments = payload.presentationComments ?? context.evaluation?.presentationComments ?? null;
  const qaComments = payload.qaComments ?? context.evaluation?.comments ?? null;
  const finalFeedback = payload.finalFeedback ?? context.evaluation?.finalFeedback ?? null;

  return db.transaction(async (tx) => {
    let evaluationId = context.evaluation?.id ?? null;

    if (!evaluationId) {
      const inserted = await tx
        .insert(evaluations)
        .values({
          aiGeneratedAt: context.evaluation?.aiGeneratedAt ?? null,
          aiLastError: context.evaluation?.aiLastError ?? null,
          aiRecommendedCriteria: context.evaluation?.aiRecommendedCriteria ?? null,
          aiRecommendedFeedback: context.evaluation?.aiRecommendedFeedback ?? null,
          aiRecommendedQuestions: context.evaluation?.aiRecommendedQuestions ?? null,
          aiStatus: (context.evaluation?.aiStatus ?? 'idle') as EvaluationAiStatus,
          aiStatusUpdatedAt: context.evaluation?.aiStatusUpdatedAt ?? null,
          comments: qaComments,
          evaluatorGroupId: groupId,
          finalFeedback,
          sessionId,
          submissionId: context.submission.id,
          teacherNotes: presentationComments,
          updatedAt: now
        })
        .returning({ id: evaluations.id });

      evaluationId = inserted[0]?.id ?? null;
    } else {
      await tx
        .update(evaluations)
        .set({
          comments: qaComments,
          finalFeedback,
          teacherNotes: presentationComments,
          updatedAt: now
        })
        .where(eq(evaluations.id, evaluationId));
    }

    if (!evaluationId) {
      throw new Error('Could not create evaluation row.');
    }

    if (payload.scores) {
      await tx.delete(evaluationScores).where(eq(evaluationScores.evaluationId, evaluationId));
      if (payload.scores.length > 0) {
        await tx.insert(evaluationScores).values(
          payload.scores.map((score) => ({
            evaluationId,
            feedback: score.feedback ?? null,
            rubricCriterionId: score.criterionId,
            score: score.score,
            updatedAt: now
          }))
        );
      }
    }

    return evaluationId;
  });
}

export async function setEvaluationAiStatus(
  sessionId: string,
  groupId: string,
  status: EvaluationAiStatus,
  lastError: string | null = null
) {
  const context = await getEvaluationContext(sessionId, groupId);
  if (!context.evaluation) {
    const evaluationId = await saveEvaluationDraft(sessionId, groupId, {});
    await db
      .update(evaluations)
      .set({
        aiLastError: lastError,
        aiStatus: status,
        aiStatusUpdatedAt: new Date()
      })
      .where(eq(evaluations.id, evaluationId));
    return;
  }

  await db
    .update(evaluations)
    .set({
      aiLastError: lastError,
      aiStatus: status,
      aiStatusUpdatedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(evaluations.id, context.evaluation.id));
}

export async function saveEvaluationAiResult(params: {
  aiGeneratedAt: Date;
  aiRecommendedCriteria?: EvaluationAiCriterionRecommendation[] | null;
  aiRecommendedFeedback?: EvaluationAiFeedbackSections | null;
  aiRecommendedQuestions?: string[] | null;
  sessionId: string;
  groupId: string;
}) {
  const context = await getEvaluationContext(params.sessionId, params.groupId);
  const evaluationId = context.evaluation?.id ?? (await saveEvaluationDraft(params.sessionId, params.groupId, {}));
  const nextAiRecommendedCriteria =
    params.aiRecommendedCriteria ?? context.evaluation?.aiRecommendedCriteria ?? null;
  const nextAiRecommendedFeedback =
    params.aiRecommendedFeedback ?? context.evaluation?.aiRecommendedFeedback ?? null;
  const nextAiRecommendedQuestions =
    params.aiRecommendedQuestions ?? context.evaluation?.aiRecommendedQuestions ?? null;

  await db
    .update(evaluations)
    .set({
      aiGeneratedAt: params.aiGeneratedAt,
      aiLastError: null,
      aiRecommendedCriteria: nextAiRecommendedCriteria,
      aiRecommendedFeedback: nextAiRecommendedFeedback,
      aiRecommendedQuestions: nextAiRecommendedQuestions,
      aiStatus: 'ready',
      aiStatusUpdatedAt: params.aiGeneratedAt,
      updatedAt: params.aiGeneratedAt
    })
    .where(eq(evaluations.id, evaluationId));
}

export async function finalizeEvaluationGroup(sessionId: string, groupId: string) {
  const workspace = await getEvaluationGroupWorkspace(sessionId, groupId);
  if (!workspace.readyForFinalization) {
    throw new Error('All required fields must be completed before finalizing.');
  }

  const context = await getEvaluationContext(sessionId, groupId);
  if (!context.evaluation) {
    throw new Error('Could not find a saved evaluation row.');
  }

  await db
    .update(evaluations)
    .set({
      submittedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(evaluations.id, context.evaluation.id));
}
