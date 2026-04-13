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
  presentationComments: string;
  peerQuestionsObserved: string;
  qaComments: string;
  rubric: {
    criteria: EvaluationCriterionRow[];
    id: string;
    title: string;
  } | null;
  sessionLanguage: string;
  subject: string;
  submissionContent?: string | null;
  submissionTitle?: string | null;
};

type ParsedEvaluationGradingResponse = {
  criterion_grading: Array<{
    criterion_name: string;
    evidence_used: string[];
    justification: string;
    score: number;
  }>;
  general_feedback: string | null;
  points_for_development: string[] | null;
  strengths: string[] | null;
};

const gradingResponseSchema = z
  .object({
    criterion_grading: z
      .array(
        z.object({
          criterion_name: z.string().trim().min(1),
          evidence_used: z.array(z.string().trim()).optional().default([]),
          justification: z.string().trim().min(1),
          score: z.coerce.number().int().min(0)
        })
      )
      .optional(),
    general_feedback: z.string().trim().optional(),
    points_for_development: z.array(z.string().trim()).optional(),
    strengths: z.array(z.string().trim()).optional()
  })
  .strict();

function normalizeKey(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function joinLines(lines: string[]) {
  return lines.map((line) => line.trim()).filter(Boolean).join('\n');
}

function stringifyCriteria(criteria: EvaluationCriterionRow[]) {
  return criteria
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((criterion, index) => {
      const description = criterion.description?.trim() ?? '';
      return [
        `${index + 1}. ${criterion.label} (${criterion.maxScore} points)`,
        description ? `   Description: ${description}` : null
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
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

  return peerSentences.length > 0 ? joinLines(peerSentences) : 'No peer questions were explicitly noted.';
}

function stripJsonFences(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function stringifyAiSection(lines: string[] | null | undefined) {
  const entries = (lines ?? []).map((line) => line.trim()).filter(Boolean);
  return entries.length > 0 ? entries.join('\n') : '';
}

function getPromptTemplate(prompts: Array<{ promptKey: string; template: string }>) {
  return prompts.find((prompt) => prompt.promptKey === 'generate_feedback_and_grading')?.template ?? null;
}

function buildPromptVariables(input: EvaluationGradingPromptInput) {
  return {
    evaluation_criteria: stringifyCriteria(input.criteria),
    group_name: input.groupName,
    peer_questions_observed: summarizePeerQuestionsObserved(input.peerQuestionsObserved),
    rubric: stringifyRubric(input.rubric),
    teacher_qa_comments: input.qaComments.trim() || 'No teacher Q&A comments were recorded.',
    teacher_presentation_comments:
      input.presentationComments.trim() || 'No teacher presentation comments were recorded.'
  };
}

function formatEvidenceUsed(evidenceUsed: string[]) {
  const entries = evidenceUsed.map((entry) => entry.trim()).filter(Boolean);
  return entries.length > 0 ? ` Evidence used: ${entries.join('; ')}.` : '';
}

function parseModelPayload(rawContent: string): ParsedEvaluationGradingResponse | null {
  const parsedContent = stripJsonFences(rawContent);
  if (!parsedContent.startsWith('{') || !parsedContent.endsWith('}')) {
    return null;
  }

  const jsonValue = JSON.parse(parsedContent) as unknown;
  const parsed = gradingResponseSchema.safeParse(jsonValue);

  if (!parsed.success) {
    return null;
  }

  return {
    criterion_grading: parsed.data.criterion_grading ?? [],
    general_feedback: parsed.data.general_feedback ?? null,
    points_for_development: parsed.data.points_for_development ?? null,
    strengths: parsed.data.strengths ?? null
  };
}

function buildFeedbackSectionsFromModel(
  parsed: ParsedEvaluationGradingResponse | null,
  fallback: EvaluationAiFeedbackSections
) {
  if (!parsed) {
    return fallback;
  }

  return {
    development: stringifyAiSection(parsed.points_for_development) || fallback.development,
    general: parsed.general_feedback?.trim() || fallback.general,
    strengths: stringifyAiSection(parsed.strengths) || fallback.strengths
  };
}

function matchModelCriterion(
  entry: ParsedEvaluationGradingResponse['criterion_grading'][number],
  criteria: EvaluationCriterionRow[]
) {
  const normalizedName = normalizeKey(entry.criterion_name);
  if (!normalizedName) {
    return null;
  }

  return (
    criteria.find((criterion) => normalizeKey(criterion.label) === normalizedName) ??
    criteria.find(
      (criterion) =>
        normalizeKey(criterion.label).includes(normalizedName) ||
        normalizedName.includes(normalizeKey(criterion.label))
    ) ??
    null
  );
}

function buildCriterionRecommendationsFromModel(
  parsed: ParsedEvaluationGradingResponse | null,
  input: EvaluationGradingPromptInput,
  fallbackCriteria: EvaluationAiCriterionRecommendation[]
) {
  if (!parsed || parsed.criterion_grading.length === 0) {
    return fallbackCriteria;
  }

  const fallbackByCriterionId = new Map(
    fallbackCriteria.map((recommendation) => [recommendation.criterionId, recommendation])
  );
  const assignedCriterionIds = new Set<string>();
  const recommendations: EvaluationAiCriterionRecommendation[] = [];

  for (const criterion of input.criteria.slice().sort((left, right) => left.sortOrder - right.sortOrder)) {
    const matchedEntry = parsed.criterion_grading.find((entry) => {
      const matchedCriterion = matchModelCriterion(entry, input.criteria);
      return matchedCriterion?.id === criterion.id && !assignedCriterionIds.has(criterion.id);
    });

    if (matchedEntry) {
      const score = Number.isFinite(matchedEntry.score)
        ? Math.max(0, Math.min(criterion.maxScore, matchedEntry.score))
        : fallbackByCriterionId.get(criterion.id)?.recommendedScore ?? 0;
      const rationale = `${matchedEntry.justification.trim()}${formatEvidenceUsed(
        matchedEntry.evidence_used
      )}`;

      recommendations.push({
        criterionId: criterion.id,
        criterionLabel: criterion.label,
        maxScore: criterion.maxScore,
        rationale,
        recommendedScore: score
      });
      assignedCriterionIds.add(criterion.id);
      continue;
    }

    const fallback = fallbackByCriterionId.get(criterion.id);
    if (fallback) {
      recommendations.push(fallback);
      assignedCriterionIds.add(criterion.id);
      continue;
    }

    recommendations.push({
      criterionId: criterion.id,
      criterionLabel: criterion.label,
      maxScore: criterion.maxScore,
      rationale: 'No AI recommendation was available for this criterion.',
      recommendedScore: 0
    });
  }

  return recommendations;
}

export async function generateBranchingAiGradingRecommendations(
  input: EvaluationGradingPromptInput
): Promise<{
  feedback: EvaluationAiFeedbackSections;
  recommendedCriteria: EvaluationAiCriterionRecommendation[];
}> {
  const fallback = buildEvaluationRecommendations(input);
  let settingsBundle: Awaited<ReturnType<typeof getBranchingAiFullSettings>>;

  try {
    settingsBundle = await getBranchingAiFullSettings();
  } catch {
    return fallback;
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
    return fallback;
  }

  const promptTemplate = getPromptTemplate(settingsBundle.prompts);
  if (!promptTemplate?.trim()) {
    return fallback;
  }

  try {
    const client = buildBranchingAiClient(settings, settingsBundle.apiKey!);
    const renderedPrompt = renderPromptTemplate(promptTemplate, buildPromptVariables(input));
    const systemPrompt = [
      'Return valid JSON only.',
      'Do not wrap the response in markdown or prose.',
      'Follow the template instructions exactly.',
      'The JSON object must include strengths, points_for_development, general_feedback, and criterion_grading.',
      'criterion_grading must contain one entry per rubric criterion and each criterion_name must match the rubric label exactly.'
    ].join(' ');

    const content = await client.generateChatCompletion({
      maxTokens: 1200,
      messages: [
        { content: systemPrompt, role: 'system' },
        { content: renderedPrompt, role: 'user' }
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0
    });

    const parsed = parseModelPayload(content);
    if (!parsed) {
      return fallback;
    }

    return {
      feedback: buildFeedbackSectionsFromModel(parsed, fallback.feedback),
      recommendedCriteria: buildCriterionRecommendationsFromModel(
        parsed,
        input,
        fallback.recommendedCriteria
      )
    };
  } catch {
    return fallback;
  }
}
