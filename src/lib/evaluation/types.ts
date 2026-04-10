export type EvaluationAiStatus = 'idle' | 'generating' | 'ready' | 'failed';

export type EvaluationAiCriterionRecommendation = {
  criterionId: string;
  criterionLabel: string;
  maxScore: number;
  rationale: string;
  recommendedScore: number;
};

export type EvaluationAiFeedbackSections = {
  development: string;
  general: string;
  strengths: string;
};

export type EvaluationCriterionRow = {
  description: string | null;
  feedback: string | null;
  id: string;
  label: string;
  maxScore: number;
  score: number | null;
  sortOrder: number;
};

export type EvaluationGroupMember = {
  firstName: string;
  id: string;
  lastName: string;
  schoolEmail: string;
};

export type EvaluationGroupWorkspace = {
  aiGeneratedAt: Date | null;
  aiLastError: string | null;
  aiRecommendedCriteria: EvaluationAiCriterionRecommendation[];
  aiRecommendedFeedback: EvaluationAiFeedbackSections | null;
  aiRecommendedQuestions: string[];
  aiStatus: EvaluationAiStatus;
  aiStatusUpdatedAt: Date | null;
  criteria: EvaluationCriterionRow[];
  evaluationId: string | null;
  finalFeedback: string;
  finalFeedbackSections: EvaluationAiFeedbackSections;
  groupId: string;
  groupName: string;
  presentationComments: string;
  presentationOrder: number | null;
  qaComments: string;
  readyForFinalization: boolean;
  submittedAt: Date | null;
  submissionId: string | null;
  submissionTitle: string | null;
  totalScore: number | null;
  members: EvaluationGroupMember[];
};

export type EvaluationSessionWorkspace = {
  id: string;
  language: string;
  slug: string;
  title: string;
};

export type EvaluationWorkspace = {
  groups: EvaluationGroupWorkspace[];
  rubric: {
    criteria: EvaluationCriterionRow[];
    id: string;
    title: string;
  } | null;
  session: EvaluationSessionWorkspace;
};

export type EvaluationFeedbackPatch = {
  development?: string;
  general?: string;
  strengths?: string;
};

export type EvaluationSavePayload = {
  finalFeedback?: string | null;
  presentationComments?: string | null;
  qaComments?: string | null;
  scores?: Array<{
    criterionId: string;
    feedback?: string | null;
    score: number;
  }>;
};
