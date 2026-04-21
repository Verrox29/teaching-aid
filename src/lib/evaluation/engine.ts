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
  teacherComments?: string | null;
  sessionLanguage: string;
  submissionText: string | null;
  subject: string;
};

export type ChallengeQuestionAnchorDebug = {
  critiqueAnchor: string;
  primaryAnchor: string;
  secondaryAnchor: string;
  submissionAnchorCandidates: string[];
  topicFocus: string;
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

function stripDiacritics(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function looksLikeNaturalWord(word: string) {
  const normalized = stripDiacritics(word).toLowerCase();

  if (normalized.length < 3) {
    return false;
  }

  if (/[0-9]/.test(normalized)) {
    return false;
  }

  if (!/[aeiouy]/.test(normalized)) {
    return false;
  }

  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(normalized)) {
    return false;
  }

  return true;
}

function isHumanReadablePhrase(value: string) {
  const line = value.replace(/\s+/g, ' ').trim();
  if (!line) {
    return false;
  }

  if (/[0-9]/.test(line)) {
    return false;
  }

  if (/[\\^_`~<>[\]{}|]/.test(line)) {
    return false;
  }

  const words = stripDiacritics(line)
    .toLowerCase()
    .split(/[^a-z]+/g)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length < 2) {
    return false;
  }

  if (words.some((word) => word.length > 18)) {
    return false;
  }

  const meaningfulWords = words.filter((word) => word.length >= 3);
  if (meaningfulWords.length < 2) {
    return false;
  }

  if (!meaningfulWords.every(looksLikeNaturalWord)) {
    return false;
  }

  const weirdCharacters = (line.match(/[^A-Za-z0-9À-ÿ\s.,;:!?'"()\-–—/&%+]/g) ?? []).length;
  return weirdCharacters / Math.max(1, line.length) <= 0.2;
}

function isHumanReadableChallengePhrase(value: string) {
  const line = value.replace(/\s+/g, ' ').trim();
  if (!line) {
    return false;
  }

  if (/[\\^_`~<>[\]{}|]/.test(line)) {
    return false;
  }

  const words = stripDiacritics(line)
    .toLowerCase()
    .split(/[^a-z]+/g)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length < 2) {
    return false;
  }

  if (words.some((word) => word.length > 18)) {
    return false;
  }

  const meaningfulWords = words.filter((word) => word.length >= 3);
  if (meaningfulWords.length < 2) {
    return false;
  }

  if (!meaningfulWords.every(looksLikeNaturalWord)) {
    return false;
  }

  const weirdCharacters = (line.match(/[^A-Za-z0-9À-ÿ\s.,;:!?'"()\-–—/&%+]/g) ?? []).length;
  return weirdCharacters / Math.max(1, line.length) <= 0.2;
}

function safeTopicPhrase(value: string | null | undefined, language: EvaluationLanguage) {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized || !isHumanReadablePhrase(normalized)) {
    return null;
  }

  return trimQuestionFocus(normalized, language);
}

function safeDisplayLabel(value: string | null | undefined, language: EvaluationLanguage) {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized || !isHumanReadablePhrase(normalized)) {
    return language === 'fr' ? 'ce groupe' : 'this group';
  }

  return normalized;
}

function addressPronoun(language: EvaluationLanguage) {
  return language === 'fr' ? 'vous' : 'you';
}

const FALLBACK_TOPICS: Record<EvaluationLanguage, string[]> = {
  en: ['the proposed strategy', 'the diagnosis presented', 'the proposed action plan'],
  fr: ['la stratégie proposée', 'le diagnostic présenté', 'le plan d’action proposé']
};

function isSafeQuestionAnchor(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized) {
    return false;
  }

  if (normalized.length > 80) {
    return false;
  }

  if (/(.)\1{4,}/.test(normalized)) {
    return false;
  }

  if (!isHumanReadableChallengePhrase(normalized)) {
    return false;
  }

  if (!/[A-Za-zÀ-ÿ]/.test(normalized)) {
    return false;
  }

  if (tokenizeWords(normalized).length < 3) {
    return false;
  }

  return true;
}

function extractConcreteChallengeAnchors(
  text: string,
  language: EvaluationLanguage
) {
  const anchors: string[] = [];
  const fragments = [
    ...splitSentences(text),
    ...text
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  ];

  for (const fragment of fragments) {
    const quotedMatches = [...fragment.matchAll(/[“"«](.{8,140}?)[”"»]/g)];

    for (const match of quotedMatches) {
      const quote = match[1]?.trim() ?? '';
      if (!quote) {
        continue;
      }

      const focusedQuote = trimQuestionFocus(quote, language);
      if (isSafeQuestionAnchor(focusedQuote) && !anchors.includes(focusedQuote)) {
        anchors.push(focusedQuote);
      }
    }
  }

  for (const fragment of fragments) {
    if (!/(slide|diapo|page|section|partie)\s*\d*/i.test(fragment)) {
      continue;
    }

    const focusedFragment = trimQuestionFocus(fragment, language);
    if (isSafeQuestionAnchor(focusedFragment) && !anchors.includes(focusedFragment)) {
      anchors.push(focusedFragment);
    }
  }

  for (const fragment of fragments) {
    if (tokenizeWords(fragment).length < 4) {
      continue;
    }

    const focusedFragment = trimQuestionFocus(fragment, language);
    if (isSafeQuestionAnchor(focusedFragment) && !anchors.includes(focusedFragment)) {
      anchors.push(focusedFragment);
    }
  }

  return anchors;
}

function pickSafeAnchor(
  candidates: Array<string | null | undefined>,
  language: EvaluationLanguage
) {
  for (const candidate of candidates) {
    if (isSafeQuestionAnchor(candidate)) {
      return candidate!.replace(/\s+/g, ' ').trim();
    }
  }

  return FALLBACK_TOPICS[language][0];
}

function extractSubmissionAnchors(input: EvaluationChallengeQuestionInput, language: EvaluationLanguage) {
  const content = input.submissionText?.trim() ?? '';
  const concreteAnchors = extractConcreteChallengeAnchors(content, language);
  const sentences = splitSentences(content);
  const meaningfulSentences = sentences
    .filter((sentence) => tokenizeWords(sentence).length >= 6)
    .map((sentence) => trimQuestionFocus(sentence, language))
    .filter(isSafeQuestionAnchor)
    .filter(Boolean);
  const teacherContent = input.teacherComments?.trim() ?? '';
  const teacherConcreteAnchors = extractConcreteChallengeAnchors(teacherContent, language);
  const teacherSentences = splitSentences(teacherContent)
    .filter((sentence) => tokenizeWords(sentence).length >= 4)
    .map((sentence) => trimQuestionFocus(sentence, language))
    .filter(isSafeQuestionAnchor)
    .filter(Boolean);
  const fallbackTopic =
    safeTopicPhrase(input.subject, language) ||
    safeTopicPhrase(input.className, language) ||
    safeTopicPhrase(input.teacherComments, language) ||
    (language === 'fr' ? 'la présentation' : 'the presentation');

  const primaryAnchor = concreteAnchors[0] ?? meaningfulSentences[0] ?? fallbackTopic;
  const secondaryAnchor =
    concreteAnchors.find((sentence) => sentence !== primaryAnchor) ??
    meaningfulSentences.find((sentence) => sentence !== primaryAnchor) ??
    teacherConcreteAnchors[0] ??
    teacherSentences[0] ??
    fallbackTopic;
  const critiqueAnchor = teacherConcreteAnchors[0] ?? teacherSentences[0] ?? fallbackTopic;

  return {
    primaryAnchor,
    critiqueAnchor,
    secondaryAnchor,
    fallbackTopic
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
  language: EvaluationLanguage
) {
  const anchorDebug = getChallengeQuestionAnchorDebug(input, language);
  const pronoun = addressPronoun(language);

  if (language === 'fr') {
    return [
      `Quand vous parlez de ${anchorDebug.primaryAnchor}, quelle preuve concrète dans votre travail justifie ce constat ou ce choix ?`,
      `Pourquoi avez-vous retenu ${anchorDebug.secondaryAnchor} plutôt qu’une autre option, et quel compromis cela a-t-il demandé ?`,
      `Comment justifiez-vous l’idée principale de ${anchorDebug.topicFocus} face à une question critique sur ${
        anchorDebug.critiqueAnchor === anchorDebug.topicFocus ? 'les preuves et les effets attendus' : anchorDebug.critiqueAnchor
      } ?`
    ];
  }

  return [
    `When you discuss ${anchorDebug.primaryAnchor}, what concrete evidence in the work justifies that diagnosis or choice?`,
    `Why did you choose ${anchorDebug.secondaryAnchor} instead of another option, and what trade-off did that require?`,
    `How do ${pronoun} justify the main idea of ${anchorDebug.topicFocus} when challenged on ${
      anchorDebug.critiqueAnchor === anchorDebug.topicFocus ? 'the evidence and expected impact' : anchorDebug.critiqueAnchor
    }?`
  ];
}

export function getChallengeQuestionAnchorDebug(
  input: EvaluationChallengeQuestionInput,
  language: EvaluationLanguage
): ChallengeQuestionAnchorDebug {
  const anchors = extractSubmissionAnchors(input, language);
  const submissionText = input.submissionText?.trim() ?? '';
  const submissionAnchorCandidates = Array.from(
    new Set([
      ...extractConcreteChallengeAnchors(submissionText, language),
      ...splitSentences(submissionText)
        .filter((sentence) => tokenizeWords(sentence).length >= 6)
        .map((sentence) => trimQuestionFocus(sentence, language))
        .filter(isSafeQuestionAnchor)
    ])
  ).slice(0, 8);
  const topicFocus = pickSafeAnchor(
    [anchors.fallbackTopic, input.subject, input.className, ...FALLBACK_TOPICS[language]],
    language
  );
  const primaryAnchor = pickSafeAnchor([anchors.primaryAnchor, topicFocus], language);
  const secondaryAnchor = pickSafeAnchor([anchors.secondaryAnchor, topicFocus], language);
  const critiqueAnchor = pickSafeAnchor([anchors.critiqueAnchor, topicFocus], language);

  return {
    critiqueAnchor,
    primaryAnchor,
    secondaryAnchor,
    submissionAnchorCandidates,
    topicFocus
  };
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
