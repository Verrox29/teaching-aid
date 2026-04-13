import { buildEvaluationRecommendations } from '@/lib/evaluation/engine';
import type {
  EvaluationAiCriterionRecommendation,
  EvaluationAiFeedbackSections,
  EvaluationCriterionRow
} from '@/lib/evaluation/types';

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

function looksLikeStructuredOutputSupportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /response_format|json_schema|structured output|schema/i.test(message);
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

  const promptTemplate = getPromptTemplate(settingsBundle.prompts);
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

function getPromptTemplate(prompts: Array<{ promptKey: string; template: string }>) {
  return prompts.find((prompt) => prompt.promptKey === 'generate_feedback_and_grading')?.template ?? null;
}
