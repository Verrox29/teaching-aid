import type {
  EvaluationAiCriterionRecommendation,
  EvaluationAiFeedbackSections,
  EvaluationCriterionRow
} from './types';

type EvaluationLanguage = 'en' | 'fr';

type EvaluationRecommendationInput = {
  className: string;
  criteria: EvaluationCriterionRow[];
  groupName: string;
  presentationComments: string;
  qaComments: string;
  submissionContent?: string | null;
  submissionTitle?: string | null;
  sessionLanguage: string;
  subject: string;
};

type EvaluationChallengeQuestionInput = {
  className: string;
  groupName: string;
  sessionLanguage: string;
  submissionContent: string | null;
  submissionTitle: string;
  subject: string;
};

type EvaluationFeedbackLabels = Record<keyof EvaluationAiFeedbackSections, string>;

const FEEDBACK_LABELS: Record<EvaluationLanguage, EvaluationFeedbackLabels> = {
  en: {
    development: 'Points for development',
    general: 'General feedback',
    strengths: 'Strengths'
  },
  fr: {
    development: 'Axes de développement',
    general: 'Commentaire général',
    strengths: 'Points forts'
  }
};

const POSITIVE_KEYWORDS: Record<EvaluationLanguage, string[]> = {
  en: [
    'clear',
    'confident',
    'coherent',
    'detailed',
    'effective',
    'excellent',
    'good',
    'insightful',
    'precise',
    'solid',
    'strong',
    'well prepared',
    'well structured'
  ],
  fr: [
    'clair',
    'confiant',
    'cohérent',
    'détaillé',
    'efficace',
    'excellent',
    'bon',
    'pertinent',
    'précis',
    'solide',
    'fort',
    'bien prépar',
    'bien structur'
  ]
};

const NEGATIVE_KEYWORDS: Record<EvaluationLanguage, string[]> = {
  en: [
    'confused',
    'few',
    'hesitant',
    'incomplete',
    'limited',
    'missing',
    'unclear',
    'weak'
  ],
  fr: ['confus', 'faible', 'hésitant', 'incomplet', 'limité', 'manqu', 'flou', 'peu']
};

const QA_KEYWORDS: Record<EvaluationLanguage, string[]> = {
  en: ['answer', 'answers', 'confidence', 'question', 'questions', 'response', 'teamwork'],
  fr: ['réponse', 'réponses', 'confiance', 'question', 'questions', 'interaction', 'équipe']
};

const QUESTION_STOP_WORDS: Record<EvaluationLanguage, string[]> = {
  en: [
    'about',
    'and',
    'because',
    'for',
    'from',
    'into',
    'that',
    'the',
    'their',
    'this',
    'through',
    'with',
    'your'
  ],
  fr: ['avec', 'dans', 'des', 'du', 'et', 'les', 'pour', 'que', 'sur', 'une', 'vous', 'vos']
};

function normalizeLanguage(language: string): EvaluationLanguage {
  return language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function tokenizeWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u2019']/g, ' ')
    .split(/[^a-z0-9àâçéèêëîïôùûüÿœæ]+/i)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function keywordCount(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.reduce((count, keyword) => {
    if (!keyword) {
      return count;
    }

    return normalized.includes(keyword.toLowerCase()) ? count + 1 : count;
  }, 0);
}

function signalStrength(text: string, language: EvaluationLanguage) {
  const positive = keywordCount(text, POSITIVE_KEYWORDS[language]);
  const negative = keywordCount(text, NEGATIVE_KEYWORDS[language]);
  const wordCount = tokenizeWords(text).length;

  let score = positive * 2 - negative * 2;
  if (wordCount >= 40) {
    score += 2;
  } else if (wordCount >= 18) {
    score += 1;
  } else if (wordCount < 8) {
    score -= 1;
  }

  return score;
}

function titleCaseLabel(language: EvaluationLanguage, key: keyof EvaluationAiFeedbackSections) {
  return FEEDBACK_LABELS[language][key];
}

export function getEvaluationLanguage(language: string): EvaluationLanguage {
  return normalizeLanguage(language);
}

export function formatFeedbackSections(
  sections: EvaluationAiFeedbackSections,
  language: string
) {
  const lang = normalizeLanguage(language);
  if (
    !sections.strengths.trim() &&
    !sections.development.trim() &&
    !sections.general.trim()
  ) {
    return '';
  }

  return [
    `${titleCaseLabel(lang, 'strengths')}\n${sections.strengths.trim()}`,
    `${titleCaseLabel(lang, 'development')}\n${sections.development.trim()}`,
    `${titleCaseLabel(lang, 'general')}\n${sections.general.trim()}`
  ]
    .map((section) => section.trim())
    .join('\n\n');
}

export function parseFeedbackSections(
  value: string | null | undefined,
  language: string
): EvaluationAiFeedbackSections {
  const lang = normalizeLanguage(language);
  const labels = FEEDBACK_LABELS[lang];
  const normalizedValue = value?.trim() ?? '';

  if (!normalizedValue) {
    return {
      development: '',
      general: '',
      strengths: ''
    };
  }

  const sections: EvaluationAiFeedbackSections = {
    development: '',
    general: '',
    strengths: ''
  };

  let currentKey: keyof EvaluationAiFeedbackSections | null = null;
  const lines = normalizedValue.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (currentKey) {
        sections[currentKey] = `${sections[currentKey]}\n`;
      }
      continue;
    }

    const matchingEntry = (Object.entries(labels) as Array<
      [keyof EvaluationAiFeedbackSections, string]
    >).find(([, label]) => line.toLowerCase() === label.toLowerCase());

    if (matchingEntry) {
      currentKey = matchingEntry[0];
      continue;
    }

    if (!currentKey) {
      currentKey = 'general';
    }

    sections[currentKey] = sections[currentKey]
      ? `${sections[currentKey]}\n${rawLine}`
      : rawLine;
  }

  return {
    development: sections.development.trim(),
    general: sections.general.trim(),
    strengths: sections.strengths.trim()
  };
}

function sentenceJoin(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(' ');
}

function sectionHasContent(section: string) {
  return section.trim().length > 0;
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function trimQuestionFocus(value: string, language: EvaluationLanguage) {
  const words = tokenizeWords(value).filter((word) => {
    if (word.length < 4) {
      return false;
    }

    return !QUESTION_STOP_WORDS[language].includes(word);
  });

  const focus = words.slice(0, 10).join(' ');
  return focus || value.trim();
}

function extractSubmissionAnchors(input: EvaluationChallengeQuestionInput, language: EvaluationLanguage) {
  const title = input.submissionTitle.trim();
  const content = input.submissionContent?.trim() ?? '';
  const sentences = splitSentences(content);
  const meaningfulSentences = sentences
    .filter((sentence) => tokenizeWords(sentence).length >= 6)
    .map((sentence) => trimQuestionFocus(sentence, language))
    .filter(Boolean);
  const keyTerms = tokenizeWords(`${title} ${content}`)
    .filter((word) => word.length >= 4 && !QUESTION_STOP_WORDS[language].includes(word))
    .reduce<string[]>((accumulator, word) => {
      if (!accumulator.includes(word)) {
        accumulator.push(word);
      }
      return accumulator;
    }, []);

  const primaryAnchor =
    meaningfulSentences[0] ?? trimQuestionFocus(title, language) ?? (language === 'fr' ? 'le travail présenté' : 'the uploaded work');
  const secondaryAnchor =
    meaningfulSentences.find((sentence) => sentence !== primaryAnchor) ??
    keyTerms.slice(1, 4).join(' ') ??
    primaryAnchor;
  const evidenceAnchor =
    keyTerms[0] ?? meaningfulSentences[0] ?? trimQuestionFocus(title, language) ?? (language === 'fr' ? 'le travail présenté' : 'the uploaded work');

  return {
    evidenceAnchor,
    primaryAnchor,
    secondaryAnchor
  };
}

function summarizeNotes(text: string, language: EvaluationLanguage) {
  const normalized = text.trim();
  if (!normalized) {
    return language === 'fr'
      ? 'Aucune note détaillée n’a encore été saisie.'
      : 'No detailed notes have been entered yet.';
  }

  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? normalized;
  return firstSentence.trim();
}

function buildStrengthsSummary(
  input: EvaluationRecommendationInput,
  language: EvaluationLanguage,
  recommendedCriteria: EvaluationAiCriterionRecommendation[]
) {
  const strongest = [...recommendedCriteria]
    .sort((left, right) => right.recommendedScore - left.recommendedScore)
    .slice(0, 2);

  if (language === 'fr') {
    const parts = [
      `Le groupe ${input.groupName} montre ${summarizeNotes(input.presentationComments, language).toLowerCase()}`,
      strongest.length
        ? `Les points les plus solides concernent ${strongest
            .map((criterion) => criterion.criterionLabel.toLowerCase())
            .join(' et ')}.`
        : ''
    ];
    return sentenceJoin(parts);
  }

  const parts = [
    `The group ${input.groupName} shows ${summarizeNotes(input.presentationComments, language).toLowerCase()}`,
    strongest.length
      ? `The strongest areas are ${strongest
          .map((criterion) => criterion.criterionLabel.toLowerCase())
          .join(' and ')}.`
      : ''
  ];
  return sentenceJoin(parts);
}

function buildDevelopmentSummary(
  input: EvaluationRecommendationInput,
  language: EvaluationLanguage,
  recommendedCriteria: EvaluationAiCriterionRecommendation[]
) {
  const weakest = [...recommendedCriteria]
    .sort((left, right) => left.recommendedScore - right.recommendedScore)
    .slice(0, 2);
  const qaSummary = summarizeNotes(input.qaComments, language);
  const interactionSummary = buildQaInteractionSummary(input.qaComments, language);

  if (language === 'fr') {
    const parts = [
      weakest.length
        ? `La progression peut se concentrer sur ${weakest
            .map((criterion) => criterion.criterionLabel.toLowerCase())
            .join(' et ')}.`
        : '',
      sectionHasContent(input.qaComments) ? `Les échanges en questions-réponses montrent que ${qaSummary.toLowerCase()}` : '',
      interactionSummary
    ];
    return sentenceJoin(parts);
  }

  const parts = [
    weakest.length
      ? `Development can focus on ${weakest
          .map((criterion) => criterion.criterionLabel.toLowerCase())
          .join(' and ')}.`
      : '',
    sectionHasContent(input.qaComments) ? `The Q&A notes suggest that ${qaSummary.toLowerCase()}` : '',
    interactionSummary
  ];
  return sentenceJoin(parts);
}

function buildGeneralSummary(
  input: EvaluationRecommendationInput,
  language: EvaluationLanguage,
  recommendedCriteria: EvaluationAiCriterionRecommendation[]
) {
  const average =
    recommendedCriteria.length === 0
      ? 0
      : recommendedCriteria.reduce((sum, criterion) => sum + criterion.recommendedScore, 0) /
        recommendedCriteria.length;

  if (language === 'fr') {
    return average >= 4
      ? `Appréciation globale positive pour ${input.className} autour du sujet ${input.subject.toLowerCase()}.`
      : `Appréciation globale encourageante avec des marges de progression claires pour ${input.className}.`;
  }

  return average >= 4
    ? `Overall positive assessment for ${input.className} on ${input.subject.toLowerCase()}.`
    : `Overall encouraging assessment with clear room for growth for ${input.className}.`;
}

function buildQaInteractionSummary(qaComments: string, language: EvaluationLanguage) {
  if (!sectionHasContent(qaComments)) {
    return '';
  }

  const normalized = qaComments.toLowerCase();
  const teacherMentions =
    language === 'fr'
      ? ['enseignant', 'enseignante', 'professeur', 'questions du professeur', 'question du professeur']
      : ['teacher', 'professor', 'teacher question', 'teacher questions', 'teacher asked'];
  const peerMentions =
    language === 'fr'
      ? ['autre groupe', 'autres groupes', 'questions des autres groupes', 'questions du groupe']
      : ['other group', 'other groups', 'peer question', 'peer questions', 'class question'];

  const mentionsTeacher = teacherMentions.some((phrase) => normalized.includes(phrase));
  const mentionsPeers = peerMentions.some((phrase) => normalized.includes(phrase));

  if (language === 'fr') {
    if (mentionsTeacher && mentionsPeers) {
      return 'Les questions du professeur et des autres groupes montrent que le groupe a dû défendre ses choix à l’oral.';
    }

    if (mentionsTeacher) {
      return 'Les questions du professeur montrent que le groupe a dû défendre ses choix à l’oral.';
    }

    if (mentionsPeers) {
      return 'Les questions des autres groupes montrent que le groupe a dû défendre ses choix à l’oral.';
    }

    return 'Les échanges en questions-réponses confirment une maîtrise orale à vérifier dans la discussion.';
  }

  if (mentionsTeacher && mentionsPeers) {
    return 'Questions from the teacher and other groups show the team had to defend its choices orally.';
  }

  if (mentionsTeacher) {
    return 'Teacher questions show the team had to defend its choices orally.';
  }

  if (mentionsPeers) {
    return 'Questions from other groups show the team had to defend its choices orally.';
  }

  return 'The Q&A exchanges confirm that oral mastery should be checked through discussion.';
}

export function buildChallengeQuestions(
  input: EvaluationChallengeQuestionInput,
  language: EvaluationLanguage,
) {
  const anchors = extractSubmissionAnchors(input, language);
  const titleFocus =
    trimQuestionFocus(input.submissionTitle, language) ||
    (language === 'fr' ? 'le travail présenté' : 'the uploaded work');

  if (language === 'fr') {
    return [
      `Dans la partie qui porte sur ${anchors.primaryAnchor}, quelle preuve concrète dans votre travail justifie ce choix ?`,
      `Pourquoi avez-vous retenu ${anchors.secondaryAnchor} plutôt qu’une autre option, et quel compromis cela a-t-il demandé ?`,
      `Comment le groupe ${input.groupName} défend-il l’idée principale de ${titleFocus} face à une question critique ?`
    ];
  }

  return [
    `In the part about ${anchors.primaryAnchor}, what concrete evidence in the uploaded work justifies that choice?`,
    `Why did you choose ${anchors.secondaryAnchor} instead of another option, and what trade-off did that require?`,
    `How does group ${input.groupName} defend the main idea of ${titleFocus} when challenged on the details?`
  ];
}

function scoreCriterion(
  input: EvaluationRecommendationInput,
  language: EvaluationLanguage,
  criterion: EvaluationCriterionRow
) {
  const baseSignal = signalStrength(input.presentationComments, language);
  const qaSignal = signalStrength(input.qaComments, language);
  const criterionSignal =
    keywordCount(`${criterion.label} ${criterion.description ?? ''}`, QA_KEYWORDS[language]) > 0
      ? 1
      : 0;
  const upperLabel = `${criterion.label} ${criterion.description ?? ''}`.toLowerCase();
  const isOralCriterion =
    upperLabel.includes('oral') ||
    upperLabel.includes('question') ||
    upperLabel.includes('soutenance') ||
    upperLabel.includes('answer') ||
    upperLabel.includes('interaction') ||
    upperLabel.includes('q&a') ||
    upperLabel.includes('présent') ||
    upperLabel.includes('confidence');

  const notesBoost = baseSignal + (isOralCriterion ? qaSignal : Math.floor(qaSignal / 2)) + criterionSignal;
  const normalized = 0.34 + notesBoost * 0.06;
  let recommendedScore = clamp(Math.round(criterion.maxScore * normalized), 0, criterion.maxScore);

  const exceptionalThreshold = 10;
  if (recommendedScore >= criterion.maxScore && notesBoost < exceptionalThreshold) {
    recommendedScore = Math.max(0, criterion.maxScore - 1);
  }

  const rationale =
    language === 'fr'
      ? `Note recommandée basée sur les observations de la présentation${isOralCriterion && sectionHasContent(input.qaComments) ? ' et sur la qualité des réponses en questions-réponses' : ''}.`
      : `Recommended based on the presentation notes${isOralCriterion && sectionHasContent(input.qaComments) ? ' and the quality of the Q&A responses' : ''}.`;

  return {
    criterionId: criterion.id,
    criterionLabel: criterion.label,
    maxScore: criterion.maxScore,
    rationale,
    recommendedScore
  } satisfies EvaluationAiCriterionRecommendation;
}

export function buildEvaluationRecommendations(input: EvaluationRecommendationInput) {
  const language = normalizeLanguage(input.sessionLanguage);
  const recommendedCriteria = input.criteria
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((criterion) => scoreCriterion(input, language, criterion));

  return {
    feedback: {
      development: buildDevelopmentSummary(input, language, recommendedCriteria),
      general: buildGeneralSummary(input, language, recommendedCriteria),
      strengths: buildStrengthsSummary(input, language, recommendedCriteria)
    } satisfies EvaluationAiFeedbackSections,
    recommendedCriteria,
    rationale:
      language === 'fr'
        ? 'Répartition recommandée à partir des notes de présentation, des questions-réponses et, si disponible, du travail remis.'
        : 'Recommended distribution based on presentation notes, Q&A notes, and submitted work when available.'
  };
}

export function cleanupFeedbackSections(
  sections: EvaluationAiFeedbackSections,
  language: string
) {
  const lang = normalizeLanguage(language);
  const cleanupText = (value: string) =>
    value
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.;:!?])(?!\s|$)/g, '$1 ')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const commonReplacements: Record<EvaluationLanguage, Array<[RegExp, string]>> = {
    en: [
      [/\bteh\b/gi, 'the'],
      [/\brecieve\b/gi, 'receive'],
      [/\bseperate\b/gi, 'separate'],
      [/\bthier\b/gi, 'their']
    ],
    fr: [
      [/\beth\b/gi, 'et'],
      [/\betudiant\b/gi, 'étudiant'],
      [/\bdevelopp\b/gi, 'développ'],
      [/\bquestions reponses\b/gi, 'questions-réponses']
    ]
  };

  const applyCommonReplacements = (value: string) =>
    commonReplacements[lang].reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value);

  return {
    development: cleanupText(applyCommonReplacements(sections.development)),
    general: cleanupText(applyCommonReplacements(sections.general)),
    strengths: cleanupText(applyCommonReplacements(sections.strengths))
  } satisfies EvaluationAiFeedbackSections;
}
