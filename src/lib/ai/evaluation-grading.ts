import { z } from 'zod';

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

export type BranchingAiGradingResult = {
  feedback: EvaluationAiFeedbackSections;
  recommendedCriteria: EvaluationAiCriterionRecommendation[];
  recommendedTotalScore: number;
};

const gradingResponseSchema = z
  .object({
    commentSections: z
      .object({
        areasForDevelopment: z.string().trim().min(1),
        gradeBreakdown: z.string().trim().min(1),
        overallFeedback: z.string().trim().min(1),
        questionsAndComments: z.string().trim().min(1),
        strengths: z.string().trim().min(1)
      })
      .strict(),
    criteria: z
      .array(
        z
          .object({
            id: z.string().trim().min(1),
            justification: z.string().trim().min(1),
            score: z.number().finite()
          })
          .strict()
      )
      .min(1)
  })
  .strict();

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

function summarizePeerQuestionsObserved(qaComments: string) {
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

function stripJsonFences(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function getPromptTemplate(prompts: Array<{ promptKey: string; template: string }>) {
  return prompts.find((prompt) => prompt.promptKey === 'generate_feedback_and_grading')?.template ?? null;
}

function buildPromptVariables(input: EvaluationGradingPromptInput) {
  const sessionLanguage = normalizeLanguage(input.sessionLanguage);

  return {
    class_name: input.className,
    evaluation_criteria: stringifyCriteria(input.criteria),
    group_name: input.groupName,
    peer_questions_observed: summarizePeerQuestionsObserved(input.peerQuestionsObserved),
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
    '- Return valid JSON only, with no markdown and no prose outside the JSON object.',
    '- Use the exact rubric criterion ids provided below.',
    '- Return exactly one criterion result per rubric criterion id, with no omissions and no extras.',
    '- Never rename, merge, duplicate, or invent criteria.',
    '- If evidence is missing, say so explicitly and score conservatively.',
    '- Keep justifications criterion-specific; do not reuse one generic explanation across all criteria.',
    '- Clamp every score to the criterion maxScore.',
    '- Use conservative scoring and reserve the top score for truly exceptional evidence.',
    '- A perfect 20/20 total should be extremely rare.',
    '- Write the feedback sections in the session language.',
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
    '      "id": "criterion-id",',
    '      "score": 0,',
    '      "justification": "..."',
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

function parseModelPayload(rawContent: string): ParsedEvaluationGradingResponse | null {
  try {
    const parsedContent = stripJsonFences(rawContent);
    if (!parsedContent.startsWith('{') || !parsedContent.endsWith('}')) {
      return null;
    }

    const jsonValue = JSON.parse(parsedContent) as unknown;
    const parsed = gradingResponseSchema.safeParse(jsonValue);
    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
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
  const expectedIds = new Set(criteria.map((criterion) => criterion.id));
  if (parsed.criteria.length !== expectedIds.size) {
    return false;
  }

  const seenIds = new Set<string>();
  for (const entry of parsed.criteria) {
    if (!expectedIds.has(entry.id) || seenIds.has(entry.id)) {
      return false;
    }
    seenIds.add(entry.id);
  }

  return seenIds.size === expectedIds.size;
}

function buildCriterionRecommendationsFromModel(
  parsed: ParsedEvaluationGradingResponse | null,
  input: EvaluationGradingPromptInput,
  fallbackCriteria: EvaluationAiCriterionRecommendation[]
) {
  if (!parsed || !validateCriterionSet(parsed, input.criteria)) {
    return fallbackCriteria;
  }

  const parsedByCriterionId = new Map(parsed.criteria.map((entry) => [entry.id, entry]));

  return sortCriteria(input.criteria).map((criterion) => {
    const matchedEntry = parsedByCriterionId.get(criterion.id);
    const normalizedScore = matchedEntry
      ? clamp(roundToIncrement(matchedEntry.score, 0.5), 0, criterion.maxScore)
      : 0;

    return {
      criterionId: criterion.id,
      criterionLabel: criterion.label,
      maxScore: criterion.maxScore,
      rationale: matchedEntry?.justification.trim() ?? 'No AI recommendation was available for this criterion.',
      recommendedScore: normalizedScore
    };
  });
}

export async function generateBranchingAiGradingRecommendations(
  input: EvaluationGradingPromptInput
): Promise<BranchingAiGradingResult> {
  const fallback = buildEvaluationRecommendations(input);
  let settingsBundle: Awaited<ReturnType<typeof getBranchingAiFullSettings>>;

  try {
    settingsBundle = await getBranchingAiFullSettings();
  } catch {
    return {
      ...fallback,
      recommendedTotalScore: computeTotalScore(fallback.recommendedCriteria)
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
      recommendedTotalScore: computeTotalScore(fallback.recommendedCriteria)
    };
  }

  const promptTemplate = getPromptTemplate(settingsBundle.prompts);
  if (!promptTemplate?.trim()) {
    return {
      ...fallback,
      recommendedTotalScore: computeTotalScore(fallback.recommendedCriteria)
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

    const content = await client.generateChatCompletion({
      maxTokens: 1800,
      messages: [
        { content: systemPrompt, role: 'system' },
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
          role: 'user'
        }
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0
    });

    const parsed = parseModelPayload(content);
    if (!parsed || !validateCriterionSet(parsed, input.criteria)) {
      return {
        ...fallback,
        recommendedTotalScore: computeTotalScore(fallback.recommendedCriteria)
      };
    }

    const recommendedCriteria = buildCriterionRecommendationsFromModel(
      parsed,
      input,
      fallback.recommendedCriteria
    );

    return {
      feedback: buildFeedbackSectionsFromModel(parsed, fallback.feedback),
      recommendedCriteria,
      recommendedTotalScore: computeTotalScore(recommendedCriteria)
    };
  } catch {
    return {
      ...fallback,
      recommendedTotalScore: computeTotalScore(fallback.recommendedCriteria)
    };
  }
}
