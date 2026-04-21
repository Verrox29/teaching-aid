import {
  buildChallengeQuestions,
  buildEvaluationRecommendations,
  getChallengeQuestionAnchorDebug
} from '@/lib/evaluation/engine';
import type { ChallengeQuestionAnchorDebug } from '@/lib/evaluation/engine';
import type {
  EvaluationAiCriterionRecommendation,
  EvaluationAiFeedbackSections,
  EvaluationCriterionRow
} from '@/lib/evaluation/types';
import type {
  BranchingAiChallengeQuestionValidationSettings,
  BranchingAiVerificationStatus
} from './types';
import { DEFAULT_BRANCHING_AI_CHALLENGE_QUESTION_VALIDATION_SETTINGS } from './types';

import { buildBranchingAiClient } from './provider';
import { getBranchingAiFullSettings } from './settings-repository';
import { renderPromptTemplate } from './prompt-renderer';

type EvaluationGradingPromptInput = {
  className: string;
  criteria: EvaluationCriterionRow[];
  groupName: string;
  peerQuestionsObserved: string;
  presentationComments: string;
  qaComments: string;
  rubric: {
    criteria: EvaluationCriterionRow[];
    id: string;
    title: string;
  } | null;
  sessionContext: string;
  sessionLanguage: string;
  subject: string;
  submissionContent?: string | null;
  submissionTitle?: string | null;
};

type EvaluationChallengeQuestionPromptInput = {
  assignmentBrief: string;
  className: string;
  evaluationCriteria: EvaluationCriterionRow[];
  groupName: string;
  presentationContent: string;
  sessionContext: string;
  sessionLanguage: string;
  submissionText: string | null;
  subject: string;
};

type ParsedEvaluationGradingResponse = {
  commentSections: {
    areasForDevelopment: string;
    gradeBreakdown: string;
    overallFeedback: string;
    questionsAndComments: string;
    strengths: string;
  };
  criteria: Array<{
    id: string;
    justification: string;
    score: number;
  }>;
};

type ParseOutcome =
  | {
      parsed: ParsedEvaluationGradingResponse;
      repairApplied: boolean;
    }
  | {
      parsed: null;
      reason: string;
    };

type ChallengeQuestionValidationResult = {
  accepted: boolean;
  question: string;
  rejectionReasons: string[];
};

type ChallengeQuestionParseDebug = {
  parsedQuestionsBeforeValidation: string[] | null;
  questionRejectionReasons: string[];
  questionValidationResults: ChallengeQuestionValidationResult[];
};

type ParsedChallengeQuestionsOutcome =
  | {
      debug: ChallengeQuestionParseDebug;
      parsed: string[];
      repairApplied: boolean;
    }
  | {
      debug: ChallengeQuestionParseDebug;
      parsed: null;
      repairApplied: boolean;
      reason: string;
    };

export type BranchingAiGradingResult = {
  diagnostics: {
    fallbackReason: string | null;
    repairApplied: boolean;
    responseFormat: 'json_schema' | 'json_object' | 'heuristic_fallback';
  };
  feedback: EvaluationAiFeedbackSections;
  recommendedCriteria: EvaluationAiCriterionRecommendation[];
  recommendedTotalScore: number;
};

export type BranchingAiChallengeQuestionsResult = {
  diagnostics: {
    fallbackReason: string | null;
    repairApplied: boolean;
    responseFormat: 'json_schema' | 'json_object' | 'heuristic_fallback';
  };
  debug?: BranchingAiChallengeQuestionsDebug;
  questions: string[];
};

export type BranchingAiChallengeQuestionsDebug = {
  fallbackReason: string | null;
  model: string | null;
  promptKeyUsed: 'generate_challenge_questions';
  parsedQuestionsBeforeValidation: string[] | null;
  promptTemplateSnippet: string;
  provider: string | null;
  primaryAnchor: string;
  questionRejectionReasons: string[];
  questionValidationResults: Array<{
    accepted: boolean;
    question: string;
    rejectionReasons: string[];
  }>;
  renderedPromptSnippet: string;
  rawModelResponse: string;
  secondaryAnchor: string;
  submissionAnchorCandidates: string[];
  submissionTextSnippet: string;
  critiqueAnchor: string;
  topicFocus: string;
  usedBranchingAi: boolean;
  verificationStatus: BranchingAiVerificationStatus;
};

const gradingResponseJsonSchema = {
  additionalProperties: false,
  properties: {
    commentSections: {
      additionalProperties: false,
      properties: {
        areasForDevelopment: { type: 'string' },
        gradeBreakdown: { type: 'string' },
        overallFeedback: { type: 'string' },
        questionsAndComments: { type: 'string' },
        strengths: { type: 'string' }
      },
      required: [
        'areasForDevelopment',
        'gradeBreakdown',
        'overallFeedback',
        'questionsAndComments',
        'strengths'
      ],
      type: 'object'
    },
    criteria: {
      items: {
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          justification: { type: 'string' },
          score: { type: 'number' }
        },
        required: ['id', 'justification', 'score'],
        type: 'object'
      },
      minItems: 1,
      type: 'array'
    }
  },
  required: ['commentSections', 'criteria'],
  type: 'object'
} as const;

const QUESTION_VARIATION_FOCI: Record<'en' | 'fr', string[]> = {
  en: [
    'diagnosis and problem statement',
    'rationale behind the chosen solution',
    'trade-offs and limitations',
    'evidence, impact, and ROI',
    'defense under critical questioning'
  ],
  fr: [
    'le diagnostic et le problème posé',
    'la raison du choix de solution',
    'les compromis et les limites',
    'les preuves, l’impact et le ROI',
    'la défense face à une question critique'
  ]
};

function normalizeLanguage(language: string) {
  return language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function joinNonEmpty(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join('\n\n');
}

function roundToIncrement(value: number, increment = 0.5) {
  return Math.round(value / increment) * increment;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function computeTotalScore(criteria: Array<{ recommendedScore: number }>) {
  return criteria.reduce((sum, criterion) => sum + criterion.recommendedScore, 0);
}

function sortCriteria(criteria: EvaluationCriterionRow[]) {
  return [...criteria].sort((left, right) => left.sortOrder - right.sortOrder);
}

function stringifyCriteria(criteria: EvaluationCriterionRow[]) {
  return sortCriteria(criteria)
    .map((criterion) => {
      const description = criterion.description?.trim() ?? '';
      return [
        `- id: ${criterion.id}`,
        `  label: ${criterion.label}`,
        `  maxScore: ${criterion.maxScore}`,
        `  sortOrder: ${criterion.sortOrder}`,
        description ? `  description: ${description}` : null
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function stringifyCriteriaJson(criteria: EvaluationCriterionRow[]) {
  return JSON.stringify(
    sortCriteria(criteria).map((criterion) => ({
      description: criterion.description,
      id: criterion.id,
      label: criterion.label,
      maxScore: criterion.maxScore,
      sortOrder: criterion.sortOrder
    })),
    null,
    2
  );
}

function stringifyRubric(rubric: EvaluationGradingPromptInput['rubric']) {
  if (!rubric) {
    return 'No active rubric found.';
  }

  return [
    `Rubric: ${rubric.title}`,
    `Rubric ID: ${rubric.id}`,
    'Criteria:',
    stringifyCriteria(rubric.criteria)
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPeerQuestionsObservedSummary(qaComments: string) {
  const trimmed = qaComments.trim();
  if (!trimmed) {
    return 'No peer questions were recorded.';
  }

  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  const peerSentences = sentences.filter((sentence) =>
    /peer|other group|other groups|class question|class questions|student question|student questions/i.test(
      sentence
    )
  );

  return peerSentences.length > 0
    ? peerSentences.map((line) => line.trim()).filter(Boolean).join('\n')
    : 'No peer questions were explicitly noted.';
}

export function derivePeerQuestionsObserved(qaComments: string) {
  return buildPeerQuestionsObservedSummary(qaComments);
}

function stripJsonFences(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonCandidate(value: string) {
  const stripped = stripJsonFences(value);
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1).trim();
  }

  return stripped;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
}

function coerceNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim() ?? '').find(Boolean) ?? '';
}

function getTextByAliases(source: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = coerceText(source[alias]);
    if (value) {
      return value;
    }
  }

  return '';
}

function normalizeCommentSections(payload: Record<string, unknown>) {
  const candidate = isRecord(payload.commentSections) ? payload.commentSections : payload;

  return {
    areasForDevelopment: getTextByAliases(candidate, [
      'areasForDevelopment',
      'areas_for_development',
      'development',
      'pointsForDevelopment',
      'points_for_development'
    ]),
    gradeBreakdown: getTextByAliases(candidate, [
      'gradeBreakdown',
      'grade_breakdown',
      'scoreBreakdown',
      'score_breakdown'
    ]),
    overallFeedback: getTextByAliases(candidate, [
      'overallFeedback',
      'overall_feedback',
      'feedback',
      'summary'
    ]),
    questionsAndComments: getTextByAliases(candidate, [
      'questionsAndComments',
      'questions_and_comments',
      'peerQuestions',
      'peer_questions'
    ]),
    strengths: getTextByAliases(candidate, ['strengths', 'strength'])
  };
}

function normalizeCriterionEntry(entry: unknown, fallbackId: string | null = null) {
  if (!isRecord(entry)) {
    return null;
  }

  const id = firstNonEmpty(
    coerceText(entry.id),
    coerceText(entry.criterionId),
    coerceText(entry.criterion_id),
    fallbackId
  );
  const score = coerceNumber(entry.score ?? entry.recommendedScore ?? entry.recommended_score);

  if (!id || score === null) {
    return null;
  }

  const justification = firstNonEmpty(
    coerceText(entry.justification),
    coerceText(entry.rationale),
    coerceText(entry.explanation),
    coerceText(entry.feedback),
    coerceText(entry.reason)
  );

  return {
    id,
    justification: justification || `AI score provided for criterion ${id}.`,
    score
  };
}

function normalizeCriteriaEntries(payload: Record<string, unknown>) {
  const candidate = payload.criteria ?? payload.recommendations ?? payload.rubricCriteria;
  const normalized: Array<{ id: string; justification: string; score: number }> = [];

  if (Array.isArray(candidate)) {
    for (const entry of candidate) {
      const normalizedEntry = normalizeCriterionEntry(entry);
      if (normalizedEntry) {
        normalized.push(normalizedEntry);
      }
    }
  } else if (isRecord(candidate)) {
    for (const [id, entry] of Object.entries(candidate)) {
      const normalizedEntry = normalizeCriterionEntry(entry, id);
      if (normalizedEntry) {
        normalized.push(normalizedEntry);
      }
    }
  }

  return normalized;
}

function normalizeModelPayload(payload: unknown): ParsedEvaluationGradingResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const commentSections = normalizeCommentSections(payload);
  const criteria = normalizeCriteriaEntries(payload);

  if (criteria.length === 0) {
    return null;
  }

  return {
    commentSections,
    criteria
  };
}

function parseModelPayload(rawContent: string): ParseOutcome {
  const stripped = stripJsonFences(rawContent);
  const candidates = Array.from(
    new Set([stripped, extractJsonCandidate(rawContent)].filter(Boolean))
  );
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const normalized = normalizeModelPayload(parsed);
      if (!normalized) {
        errors.push('JSON parsed but the grading payload was missing usable criteria.');
        continue;
      }

      const repairApplied = candidate !== stripped || candidate !== rawContent.trim();
      return {
        parsed: normalized,
        repairApplied
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Could not parse model output.');
    }
  }

  return {
    parsed: null,
    reason: errors[0] ?? 'The model did not return valid JSON.'
  };
}

function buildPromptVariables(input: EvaluationGradingPromptInput) {
  const sessionLanguage = normalizeLanguage(input.sessionLanguage);

  return {
    class_name: input.className,
    evaluation_criteria: stringifyCriteria(input.criteria),
    group_name: input.groupName,
    peer_questions_observed: normalizeText(input.peerQuestionsObserved) || 'No peer questions were recorded.',
    project_brief: normalizeText(input.sessionContext) || 'No project brief was provided.',
    rubric: stringifyRubric(input.rubric),
    rubric_criteria_json: stringifyCriteriaJson(input.criteria),
    session_context: normalizeText(input.sessionContext) || 'No session context was provided.',
    session_language: sessionLanguage,
    subject: input.subject,
    submission_text: normalizeText(input.submissionContent) || 'No submission text was provided.',
    submission_title: normalizeText(input.submissionTitle) || 'No submission title was provided.',
    teacher_qa_comments:
      normalizeText(input.qaComments) || 'No teacher Q&A comments were recorded.',
    teacher_presentation_comments:
      normalizeText(input.presentationComments) || 'No teacher presentation comments were recorded.'
  };
}

function buildChallengeQuestionPromptVariables(input: EvaluationChallengeQuestionPromptInput) {
  const sessionLanguage = normalizeLanguage(input.sessionLanguage);

  return {
    assignment_brief: normalizeText(input.assignmentBrief) || 'No assignment brief was provided.',
    class_name: input.className,
    evaluation_criteria: stringifyCriteria(input.evaluationCriteria),
    group_name: input.groupName,
    presentation_content: normalizeText(input.presentationContent) || 'No presentation content was provided.',
    question_variation_focus: pickQuestionVariationFocus(sessionLanguage),
    session_context: normalizeText(input.sessionContext) || 'No session context was provided.',
    session_language: sessionLanguage,
    submission_text: normalizeText(input.submissionText) || 'No submission text was provided.',
    subject: input.subject
  };
}

function buildChallengeQuestionDebug(params: {
  anchorDebug: ChallengeQuestionAnchorDebug;
  fallbackReason: string | null;
  model: string | null;
  parseDebug: ChallengeQuestionParseDebug;
  promptTemplate: string;
  provider: string | null;
  renderedPrompt: string;
  rawModelResponse: string;
  submissionText: string | null;
  usedBranchingAi: boolean;
  verificationStatus: BranchingAiVerificationStatus;
}): BranchingAiChallengeQuestionsDebug {
  const renderedPromptSnippet = snippetText(redactPromptSecrets(params.renderedPrompt), 500);
  return {
    fallbackReason: params.fallbackReason,
    critiqueAnchor: params.anchorDebug.critiqueAnchor,
    model: params.model,
    parsedQuestionsBeforeValidation: params.parseDebug.parsedQuestionsBeforeValidation,
    promptKeyUsed: 'generate_challenge_questions',
    promptTemplateSnippet: snippetText(params.promptTemplate, 300),
    provider: params.provider,
    primaryAnchor: params.anchorDebug.primaryAnchor,
    questionRejectionReasons: params.parseDebug.questionRejectionReasons,
    questionValidationResults: params.parseDebug.questionValidationResults,
    rawModelResponse: truncateDebugText(params.rawModelResponse.trim(), 12000),
    renderedPromptSnippet,
    secondaryAnchor: params.anchorDebug.secondaryAnchor,
    submissionAnchorCandidates: params.anchorDebug.submissionAnchorCandidates,
    submissionTextSnippet: snippetText(params.submissionText?.trim() ?? '', 1000),
    topicFocus: params.anchorDebug.topicFocus,
    usedBranchingAi: params.usedBranchingAi,
    verificationStatus: params.verificationStatus
  };
}

function snippetText(value: string, limit: number) {
  return value.trim().slice(0, limit);
}

function redactPromptSecrets(value: string) {
  return value
    .replace(/\bsk-[A-Za-z0-9]{20,}\b/g, '[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi, 'Bearer [redacted]')
    .replace(/\b(api[_-]?key|token|secret|password)\s*[:=]\s*([^\s\n]{8,})/gi, '$1: [redacted]');
}

function buildRuntimeScaffold(renderedPrompt: string, input: EvaluationGradingPromptInput) {
  const criteria = sortCriteria(input.criteria);
  const criteriaJson = stringifyCriteriaJson(criteria);
  const maxTotal = criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);

  return [
    'Runtime grading contract:',
    '- Return valid JSON only, with no markdown, code fences, or prose outside the JSON object.',
    '- Use the exact rubric criterion ids provided below and return one result per criterion.',
    '- Do not omit any rubric criterion, invent extras, or merge several criteria into one.',
    '- Keep the criterion order aligned with the rubric order.',
    '- If evidence is weak, score conservatively and explain the weakness clearly.',
    '- Use criterion-specific justifications and avoid copy-pasted generic text.',
    '- Clamp every score to the criterion maxScore.',
    '- Keep the output in the session language.',
    '',
    'Editable prompt template:',
    renderedPrompt.trim() || 'No editable prompt template was provided.',
    '',
    'Session context:',
    normalizeText(input.sessionContext) || 'No session context was provided.',
    '',
    'Canonical Pairagogie rubric criteria JSON:',
    criteriaJson,
    '',
    `Canonical rubric max total: ${maxTotal}`,
    '',
    'Required output schema:',
    '{',
    '  "criteria": [',
    '    {',
    '      "id": "exact-rubric-criterion-id",',
    '      "score": 0,',
    '      "justification": "criterion-specific explanation"',
    '    }',
    '  ],',
    '  "commentSections": {',
    '    "strengths": "...",',
    '    "areasForDevelopment": "...",',
    '    "overallFeedback": "...",',
    '    "questionsAndComments": "...",',
    '    "gradeBreakdown": "..."',
    '  }',
    '}'
  ].join('\n');
}

function buildFeedbackSectionsFromModel(
  parsed: ParsedEvaluationGradingResponse | null,
  fallback: EvaluationAiFeedbackSections
) {
  if (!parsed) {
    return fallback;
  }

  return {
    development: parsed.commentSections.areasForDevelopment.trim() || fallback.development,
    general:
      joinNonEmpty([
        parsed.commentSections.overallFeedback,
        parsed.commentSections.questionsAndComments,
        parsed.commentSections.gradeBreakdown
      ]) || fallback.general,
    strengths: parsed.commentSections.strengths.trim() || fallback.strengths
  };
}

function validateCriterionSet(
  parsed: ParsedEvaluationGradingResponse,
  criteria: EvaluationCriterionRow[]
) {
  const expectedIds = sortCriteria(criteria).map((criterion) => criterion.id);
  const parsedByCriterionId = new Map<string, (typeof parsed.criteria)[number]>();

  for (const entry of parsed.criteria) {
    const normalizedId = entry.id.trim();
    if (!parsedByCriterionId.has(normalizedId)) {
      parsedByCriterionId.set(normalizedId, entry);
    }
  }

  return expectedIds.every((criterionId) => parsedByCriterionId.has(criterionId));
}

function buildCriterionRecommendationsFromModel(
  parsed: ParsedEvaluationGradingResponse,
  input: EvaluationGradingPromptInput
) {
  const parsedByCriterionId = new Map(
    parsed.criteria.map((entry) => [entry.id.trim(), entry] as const)
  );

  return sortCriteria(input.criteria).map((criterion) => {
    const matchedEntry = parsedByCriterionId.get(criterion.id);
    const normalizedScore = matchedEntry
      ? clamp(roundToIncrement(matchedEntry.score, 0.5), 0, criterion.maxScore)
      : 0;

    return {
      criterionId: criterion.id,
      criterionLabel: criterion.label,
      maxScore: criterion.maxScore,
      rationale:
        matchedEntry?.justification.trim() ??
        'No AI recommendation was available for this criterion.',
      recommendedScore: normalizedScore
    };
  });
}

function buildFallbackReason(reason: string) {
  return `Branching AI grading fell back to the heuristic engine: ${reason}`;
}

function buildQuestionFallbackReason(reason: string) {
  return `Branching AI challenge questions fell back to the heuristic engine: ${reason}`;
}

function looksLikeStructuredOutputSupportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /response_format|json_schema|structured output|schema/i.test(message);
}

function pickQuestionVariationFocus(language: 'en' | 'fr') {
  const variants = QUESTION_VARIATION_FOCI[language];
  return variants[Math.floor(Math.random() * variants.length)] ?? variants[0];
}

function normalizeChallengeQuestionValidationSettings(
  settings?: BranchingAiChallengeQuestionValidationSettings | null
): BranchingAiChallengeQuestionValidationSettings {
  return {
    ...DEFAULT_BRANCHING_AI_CHALLENGE_QUESTION_VALIDATION_SETTINGS,
    ...(settings ?? {})
  };
}

function truncateDebugText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}\n...[truncated ${value.length - limit} chars]`;
}

function stringifyDebugQuestionValue(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized ?? String(value);
  } catch {
    return String(value);
  }
}

function validateChallengeQuestionText(
  value: unknown,
  language: 'en' | 'fr',
  settings: BranchingAiChallengeQuestionValidationSettings
) {
  const original = stringifyDebugQuestionValue(value);
  const normalized = original
    .replace(/^[\s\-*•\d.)]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const rejectionReasons: string[] = [];

  if (!normalized) {
    rejectionReasons.push('Empty after trimming.');
  }

  if (normalized.length > settings.maxQuestionLength) {
    rejectionReasons.push(`Question exceeds ${settings.maxQuestionLength} characters.`);
  }

  if (settings.requireReadableLetters && !/[A-Za-zÀ-ÿ]/.test(normalized)) {
    rejectionReasons.push('Question does not contain readable letters.');
  }

  if (normalized.split(/\s+/g).filter(Boolean).length < settings.minQuestionWordCount) {
    rejectionReasons.push(
      `Question has fewer than ${settings.minQuestionWordCount} words.`
    );
  }

  if (language === 'fr') {
    if (
      settings.rejectIndirectFrenchWording &&
      (/\bce groupe\b/i.test(normalized) || /\ble groupe\b/i.test(normalized))
    ) {
      rejectionReasons.push('Uses indirect wording like "ce groupe" or "le groupe".');
    }

    if (settings.requireFrenchVous && !/\bvous\b/i.test(normalized)) {
      rejectionReasons.push('Missing "vous" in the French question.');
    }
  }

  const accepted = rejectionReasons.length === 0;
  const question = accepted && !/[\?!.]$/.test(normalized) ? `${normalized}?` : normalized;

  return {
    accepted,
    question: question || original,
    rejectionReasons
  };
}

function buildChallengeQuestionsResponseJsonSchema(
  validationSettings: BranchingAiChallengeQuestionValidationSettings
) {
  return {
    additionalProperties: false,
    properties: {
      questions: {
        items: {
          maxLength: validationSettings.maxQuestionLength,
          type: 'string'
        },
        minItems: validationSettings.minAcceptedQuestions,
        maxItems: validationSettings.maxAcceptedQuestions,
        type: 'array'
      }
    },
    required: ['questions'],
    type: 'object'
  } as const;
}

function parseChallengeQuestionsResponse(
  rawContent: string,
  language: 'en' | 'fr',
  validationSettings: BranchingAiChallengeQuestionValidationSettings
): ParsedChallengeQuestionsOutcome {
  const stripped = stripJsonFences(rawContent);
  const candidates = Array.from(
    new Set([stripped, extractJsonCandidate(rawContent)].filter(Boolean))
  );
  const errors: string[] = [];
  const blankDebug: ChallengeQuestionParseDebug = {
    parsedQuestionsBeforeValidation: null,
    questionRejectionReasons: [],
    questionValidationResults: []
  };
  let lastDebug = blankDebug;

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const questions = isRecord(parsed)
        ? parsed.questions ?? parsed.challengeQuestions ?? parsed.items
        : Array.isArray(parsed)
          ? parsed
          : null;
      const candidateDebug: ChallengeQuestionParseDebug = {
        parsedQuestionsBeforeValidation: null,
        questionRejectionReasons: [],
        questionValidationResults: []
      };

      if (Array.isArray(questions)) {
        candidateDebug.parsedQuestionsBeforeValidation = questions.map((entry) =>
          stringifyDebugQuestionValue(entry)
        );
      }

      if (!Array.isArray(questions)) {
        candidateDebug.questionRejectionReasons.push(
          'JSON parsed but the challenge question payload was missing usable questions.'
        );
        lastDebug = candidateDebug;
        errors.push('JSON parsed but the challenge question payload was missing usable questions.');
        continue;
      }

      const validationResults: ChallengeQuestionValidationResult[] = [];
      const acceptedQuestions: string[] = [];
      const questionRejectionReasons: string[] = [];

      for (const entry of questions) {
        const validation = validateChallengeQuestionText(entry, language, validationSettings);
        const finalQuestion = validation.accepted
          ? validation.question
          : stringifyDebugQuestionValue(entry).trim();
        const result: ChallengeQuestionValidationResult = {
          accepted: validation.accepted,
          question: finalQuestion,
          rejectionReasons: [...validation.rejectionReasons]
        };

        if (validation.accepted) {
          if (
            validationSettings.rejectDuplicateQuestions &&
            acceptedQuestions.includes(validation.question)
          ) {
            result.accepted = false;
            result.rejectionReasons.push('Duplicate question.');
            questionRejectionReasons.push('Duplicate question.');
          } else {
            acceptedQuestions.push(validation.question);
          }
        }

        if (!result.accepted) {
          questionRejectionReasons.push(...result.rejectionReasons);
        }

        validationResults.push(result);
      }

      candidateDebug.questionValidationResults = validationResults;
      candidateDebug.questionRejectionReasons = Array.from(new Set(questionRejectionReasons));

      if (!isRecord(parsed)) {
        const reason = 'JSON parsed but the challenge question payload was malformed.';
        candidateDebug.questionRejectionReasons = Array.from(
          new Set([...candidateDebug.questionRejectionReasons, reason])
        );
        lastDebug = candidateDebug;
        errors.push(reason);
        continue;
      }

      if (
        acceptedQuestions.length < validationSettings.minAcceptedQuestions ||
        acceptedQuestions.length > validationSettings.maxAcceptedQuestions
      ) {
        const reason =
          `Returned ${acceptedQuestions.length} usable questions after validation; expected ` +
          `${validationSettings.minAcceptedQuestions} to ${validationSettings.maxAcceptedQuestions}.`;
        candidateDebug.questionRejectionReasons = Array.from(
          new Set([...candidateDebug.questionRejectionReasons, reason])
        );
        lastDebug = candidateDebug;
        errors.push(reason);
        continue;
      }

      const repairApplied = candidate !== stripped || candidate !== rawContent.trim();
      return {
        parsed: acceptedQuestions,
        debug: candidateDebug,
        repairApplied
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Could not parse model output.');
    }
  }

  return {
    parsed: null,
    debug: lastDebug,
    repairApplied: false,
    reason: errors[0] ?? 'The model did not return valid JSON.'
  };
}

function buildChallengeQuestionRuntimeScaffold(
  renderedPrompt: string,
  input: EvaluationChallengeQuestionPromptInput,
  validationSettings: BranchingAiChallengeQuestionValidationSettings
) {
  const sessionLanguage = normalizeLanguage(input.sessionLanguage);
  const criteriaJson = stringifyCriteriaJson(input.evaluationCriteria);

  return [
    'Runtime question contract:',
    '- Return valid JSON only, with no markdown, code fences, or prose outside the JSON object.',
    `- Return exactly ${validationSettings.minAcceptedQuestions} to ${validationSettings.maxAcceptedQuestions} short oral-defense questions.`,
    '- Anchor every question in the specific presentation/work submitted by this group, not just the broad topic.',
    '- Ask what the students must defend about what they actually presented, wrote, built, or chose.',
    '- Avoid generic topic-survey questions unless they are directly grounded in the submitted work.',
    '- Prefer a concrete anchor from the presentation or submission, such as a slide number, quoted phrase, statistic, chart, example, method, or stated action.',
    validationSettings.requireFrenchVous
      ? '- Address the presenting group directly with "vous" when the session language is French.'
      : '- French questions may use direct or indirect address.',
    validationSettings.rejectIndirectFrenchWording
      ? '- Do not use indirect wording such as "ce groupe" or copy long fragments from the submission.'
      : '- Indirect wording is allowed if it stays specific and natural.',
    `- Keep each question under ${validationSettings.maxQuestionLength} characters.`,
    validationSettings.requireReadableLetters
      ? '- Each question must contain readable letters.'
      : '- Letter content is not required by the validator.',
    '- Keep each question concise, natural, and easy to say aloud.',
    '- Focus on diagnosis, rationale, trade-offs, and evidence/impact.',
    '',
    'Editable prompt template:',
    renderedPrompt.trim() || 'No editable prompt template was provided.',
    '',
    'Session language:',
    sessionLanguage,
    '',
    'Session context:',
    normalizeText(input.sessionContext) || 'No session context was provided.',
    '',
    'Canonical criteria JSON:',
    criteriaJson,
    '',
    'Required output schema:',
    '{',
    '  "questions": [',
    '    "Question 1",',
    '    "Question 2"',
    '  ]',
    '}'
  ].join('\n');
}

export async function generateBranchingAiGradingRecommendations(
  input: EvaluationGradingPromptInput
): Promise<BranchingAiGradingResult> {
  const fallback = buildEvaluationRecommendations(input);
  const fallbackTotal = computeTotalScore(fallback.recommendedCriteria);
  let settingsBundle: Awaited<ReturnType<typeof getBranchingAiFullSettings>>;

  try {
    settingsBundle = await getBranchingAiFullSettings();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Could not load Branching AI settings.';
    return {
      ...fallback,
      diagnostics: {
        fallbackReason: buildFallbackReason(reason),
        repairApplied: false,
        responseFormat: 'heuristic_fallback'
      },
      recommendedTotalScore: fallbackTotal
    };
  }

  const settings = settingsBundle.settings;

  if (
    !settings.enabled ||
    settings.verificationStatus !== 'verified' ||
    !settingsBundle.hasApiKey ||
    !settingsBundle.apiKey ||
    settings.provider !== 'openai-compatible' ||
    !settings.apiBaseUrl?.trim() ||
    !settings.model?.trim()
  ) {
    return {
      ...fallback,
      diagnostics: {
        fallbackReason: buildFallbackReason('Branching AI is not fully configured or verified.'),
        repairApplied: false,
        responseFormat: 'heuristic_fallback'
      },
      recommendedTotalScore: fallbackTotal
    };
  }

  const promptTemplate = getPromptTemplate(settingsBundle.prompts, 'generate_feedback_and_grading');
  if (!promptTemplate?.trim()) {
    return {
      ...fallback,
      diagnostics: {
        fallbackReason: buildFallbackReason('The grading prompt template is missing.'),
        repairApplied: false,
        responseFormat: 'heuristic_fallback'
      },
      recommendedTotalScore: fallbackTotal
    };
  }

  try {
    const client = buildBranchingAiClient(settings, settingsBundle.apiKey!);
    const renderedPrompt = renderPromptTemplate(promptTemplate, buildPromptVariables(input));
    const systemPrompt = [
      'You grade Pairagogie presentations.',
      'Return valid JSON only.',
      'Do not wrap the response in markdown, code fences, or prose.',
      'Follow the output schema exactly.',
      'Use the rubric criterion ids exactly as provided in the user message.',
      'One result per criterion only.',
      'Score conservatively when evidence is incomplete or weak.',
      'A perfect 20/20 should be exceptional and rare.',
      'Do not invent additional criteria or collapse multiple criteria into one.'
    ].join(' ');

    const requestMessages = [
      { content: systemPrompt, role: 'system' as const },
      {
        content: [
          buildRuntimeScaffold(renderedPrompt, input),
          '',
          'Teacher presentation comments:',
          normalizeText(input.presentationComments) || 'No teacher presentation comments were recorded.',
          '',
          'Teacher Q&A comments:',
          normalizeText(input.qaComments) || 'No teacher Q&A comments were recorded.',
          '',
          'Peer questions observed:',
          normalizeText(input.peerQuestionsObserved) || 'No peer questions were recorded.',
          '',
          'Submission title:',
          normalizeText(input.submissionTitle) || 'No submission title was provided.',
          '',
          'Submission text:',
          normalizeText(input.submissionContent) || 'No submission text was provided.'
        ]
          .filter((part) => part !== '')
          .join('\n'),
        role: 'user' as const
      }
    ];

    let content: string;
    let responseFormatUsed: 'json_schema' | 'json_object' = 'json_schema';

    try {
      content = await client.generateChatCompletion({
        maxTokens: 1800,
        messages: requestMessages,
        responseFormat: {
          json_schema: {
            name: 'pairagogie_feedback_and_grading',
            schema: gradingResponseJsonSchema,
            strict: true
          },
          type: 'json_schema'
        },
        temperature: 0
      });
    } catch (error) {
      if (!looksLikeStructuredOutputSupportError(error)) {
        throw error;
      }

      responseFormatUsed = 'json_object';
      content = await client.generateChatCompletion({
        maxTokens: 1800,
        messages: requestMessages,
        responseFormat: { type: 'json_object' },
        temperature: 0
      });
    }

    const parsedOutcome = parseModelPayload(content);
    if (!parsedOutcome.parsed || !validateCriterionSet(parsedOutcome.parsed, input.criteria)) {
      const reason = !parsedOutcome.parsed
        ? `The model returned unusable JSON: ${parsedOutcome.reason}`
        : 'The model returned criteria that did not match the rubric ids exactly.';

      return {
        ...fallback,
        diagnostics: {
          fallbackReason: buildFallbackReason(reason),
          repairApplied: parsedOutcome.parsed ? parsedOutcome.repairApplied : false,
          responseFormat: 'heuristic_fallback'
        },
        recommendedTotalScore: fallbackTotal
      };
    }

    const recommendedCriteria = buildCriterionRecommendationsFromModel(
      parsedOutcome.parsed,
      input
    );

    const repairedModelOutput = parsedOutcome.repairApplied;

    return {
      diagnostics: {
        fallbackReason: null,
        repairApplied: repairedModelOutput,
        responseFormat: responseFormatUsed
      },
      feedback: buildFeedbackSectionsFromModel(parsedOutcome.parsed, fallback.feedback),
      recommendedCriteria,
      recommendedTotalScore: computeTotalScore(recommendedCriteria)
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The Branching AI request failed.';
    return {
      ...fallback,
      diagnostics: {
        fallbackReason: buildFallbackReason(reason),
        repairApplied: false,
        responseFormat: 'heuristic_fallback'
      },
      recommendedTotalScore: fallbackTotal
    };
  }
}

export async function generateBranchingAiChallengeQuestions(
  input: EvaluationChallengeQuestionPromptInput
): Promise<BranchingAiChallengeQuestionsResult> {
  const language = normalizeLanguage(input.sessionLanguage);
  const anchorDebug = getChallengeQuestionAnchorDebug(
    {
      className: input.className,
      groupName: input.groupName,
      teacherComments: input.presentationContent,
      sessionLanguage: input.sessionLanguage,
      submissionText: input.submissionText,
      subject: input.subject
    },
    language
  );
  const fallback = buildChallengeQuestions(
    {
      className: input.className,
      groupName: input.groupName,
      teacherComments: input.presentationContent,
      sessionLanguage: input.sessionLanguage,
      submissionText: input.submissionText,
      subject: input.subject
    },
    language
  );

  let settingsBundle: Awaited<ReturnType<typeof getBranchingAiFullSettings>>;

  try {
    settingsBundle = await getBranchingAiFullSettings();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Could not load Branching AI settings.';
    const fallbackDebug = buildChallengeQuestionDebug({
      anchorDebug,
      fallbackReason: buildQuestionFallbackReason(reason),
      model: null,
      parseDebug: {
        parsedQuestionsBeforeValidation: null,
        questionRejectionReasons: [],
        questionValidationResults: []
      },
      promptTemplate: '',
      provider: null,
      rawModelResponse: '',
      renderedPrompt: '',
      submissionText: input.submissionText,
      usedBranchingAi: false,
      verificationStatus: 'not_configured'
    });
    return {
      diagnostics: {
        fallbackReason: buildQuestionFallbackReason(reason),
        repairApplied: false,
        responseFormat: 'heuristic_fallback'
      },
      debug: fallbackDebug,
      questions: fallback
    };
  }

  const settings = settingsBundle.settings;
  const validationSettings = normalizeChallengeQuestionValidationSettings(
    settings.challengeQuestionValidationSettings
  );
  const promptTemplate =
    getPromptTemplate(settingsBundle.prompts, 'generate_challenge_questions') ?? '';
  const renderedPrompt = renderPromptTemplate(
    promptTemplate,
    buildChallengeQuestionPromptVariables(input)
  );

  if (
    !settings.enabled ||
    settings.verificationStatus !== 'verified' ||
    !settingsBundle.hasApiKey ||
    !settingsBundle.apiKey ||
    settings.provider !== 'openai-compatible' ||
    !settings.apiBaseUrl?.trim() ||
    !settings.model?.trim()
  ) {
    const fallbackDebug = buildChallengeQuestionDebug({
      anchorDebug,
      fallbackReason: buildQuestionFallbackReason('Branching AI is not fully configured or verified.'),
      model: settings.model,
      parseDebug: {
        parsedQuestionsBeforeValidation: null,
        questionRejectionReasons: [],
        questionValidationResults: []
      },
      promptTemplate,
      provider: settings.provider,
      rawModelResponse: '',
      renderedPrompt,
      submissionText: input.submissionText,
      usedBranchingAi: false,
      verificationStatus: settings.verificationStatus
    });
    return {
      diagnostics: {
        fallbackReason: buildQuestionFallbackReason('Branching AI is not fully configured or verified.'),
        repairApplied: false,
        responseFormat: 'heuristic_fallback'
      },
      debug: fallbackDebug,
      questions: fallback
    };
  }

  if (!promptTemplate?.trim()) {
    const fallbackDebug = buildChallengeQuestionDebug({
      anchorDebug,
      fallbackReason: buildQuestionFallbackReason('The challenge question prompt template is missing.'),
      model: settings.model,
      parseDebug: {
        parsedQuestionsBeforeValidation: null,
        questionRejectionReasons: [],
        questionValidationResults: []
      },
      promptTemplate,
      provider: settings.provider,
      rawModelResponse: '',
      renderedPrompt,
      submissionText: input.submissionText,
      usedBranchingAi: false,
      verificationStatus: settings.verificationStatus
    });
    return {
      diagnostics: {
        fallbackReason: buildQuestionFallbackReason('The challenge question prompt template is missing.'),
        repairApplied: false,
        responseFormat: 'heuristic_fallback'
      },
      debug: fallbackDebug,
      questions: fallback
    };
  }

  try {
    const client = buildBranchingAiClient(settings, settingsBundle.apiKey!);
    const systemPrompt = [
      'You generate challenge questions for a teacher.',
      'Return valid JSON only.',
      'Do not wrap the response in markdown, code fences, or prose.',
      'Follow the output schema exactly.',
      `Return ${validationSettings.minAcceptedQuestions} to ${validationSettings.maxAcceptedQuestions} concise oral-defense questions.`,
      'Anchor every question in the specific presentation/work submitted by this group.',
      'Do not drift into generic overview questions about the broad topic unless they are directly tied to the submitted work.',
      'Each question should reference at least one concrete detail from the presentation or submission, such as a slide number, quoted phrase, statistic, chart, example, method, or stated action.',
      validationSettings.requireFrenchVous
        ? 'Address the presenting group directly with "vous" when the session language is French.'
        : 'French questions may use direct or indirect address.',
      validationSettings.rejectIndirectFrenchWording
        ? 'Do not use indirect wording such as "ce groupe".'
        : 'Indirect wording is allowed if it stays specific and natural.',
      `Keep each question under ${validationSettings.maxQuestionLength} characters.`,
      validationSettings.requireReadableLetters
        ? 'Each question must contain readable letters.'
        : 'Letter content is not required by the validator.',
      'Avoid long copied fragments from the submission.',
      'Make the question set feel fresh by varying the emphasis.'
    ].join(' ');

    const requestMessages = [
      { content: systemPrompt, role: 'system' as const },
      {
        content: buildChallengeQuestionRuntimeScaffold(renderedPrompt, input, validationSettings),
        role: 'user' as const
      }
    ];

    let content: string;
    let responseFormatUsed: 'json_schema' | 'json_object' = 'json_schema';

    try {
      content = await client.generateChatCompletion({
        maxTokens: 500,
        messages: requestMessages,
        responseFormat: {
          json_schema: {
            name: 'pairagogie_challenge_questions',
            schema: buildChallengeQuestionsResponseJsonSchema(validationSettings),
            strict: true
          },
          type: 'json_schema'
        },
        temperature: 0.7
      });
    } catch (error) {
      if (!looksLikeStructuredOutputSupportError(error)) {
        throw error;
      }

      responseFormatUsed = 'json_object';
      content = await client.generateChatCompletion({
        maxTokens: 500,
        messages: requestMessages,
        responseFormat: { type: 'json_object' },
        temperature: 0.7
      });
    }

    const parsedOutcome = parseChallengeQuestionsResponse(content, language, validationSettings);
    if (!parsedOutcome.parsed) {
      const reason = buildQuestionFallbackReason(
        `The model returned unusable JSON: ${parsedOutcome.reason}`
      );
      const debug = buildChallengeQuestionDebug({
        anchorDebug,
        fallbackReason: reason,
        model: settings.model,
        parseDebug: parsedOutcome.debug,
        promptTemplate,
        provider: settings.provider,
        rawModelResponse: content,
        renderedPrompt,
        submissionText: input.submissionText,
        usedBranchingAi: true,
        verificationStatus: settings.verificationStatus
      });
      return {
        diagnostics: {
          fallbackReason: reason,
          repairApplied: false,
          responseFormat: 'heuristic_fallback'
        },
        debug,
        questions: fallback
      };
    }

    const debug = buildChallengeQuestionDebug({
      anchorDebug,
      fallbackReason: null,
      model: settings.model,
      parseDebug: parsedOutcome.debug,
      promptTemplate,
      provider: settings.provider,
      rawModelResponse: content,
      renderedPrompt,
      submissionText: input.submissionText,
      usedBranchingAi: true,
      verificationStatus: settings.verificationStatus
    });
    return {
      diagnostics: {
        fallbackReason: null,
        repairApplied: parsedOutcome.repairApplied,
        responseFormat: responseFormatUsed
      },
      debug,
      questions: parsedOutcome.parsed
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The Branching AI request failed.';
    const debug = buildChallengeQuestionDebug({
      anchorDebug,
      fallbackReason: buildQuestionFallbackReason(reason),
      model: settings.model,
      parseDebug: {
        parsedQuestionsBeforeValidation: null,
        questionRejectionReasons: [],
        questionValidationResults: []
      },
      promptTemplate,
      provider: settings.provider,
      rawModelResponse: '',
      renderedPrompt,
      submissionText: input.submissionText,
      usedBranchingAi: true,
      verificationStatus: settings.verificationStatus
    });
    return {
      diagnostics: {
        fallbackReason: buildQuestionFallbackReason(reason),
        repairApplied: false,
        responseFormat: 'heuristic_fallback'
      },
      debug,
      questions: fallback
    };
  }
}

function getPromptTemplate(
  prompts: Array<{ promptKey: string; template: string }>,
  promptKey: 'generate_challenge_questions' | 'generate_feedback_and_grading'
) {
  return prompts.find((prompt) => prompt.promptKey === promptKey)?.template ?? null;
}
