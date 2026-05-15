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

export type ChallengePresentationUnderstanding = {
  evidencePoints: string[];
  keyDecisions: string[];
  mainConcept: string;
  namedEntities: string[];
  presentationStructure: string[];
  risksOrTradeoffs: string[];
  summary: string;
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

const UNDERSTANDING_CONCEPT_HINTS: Record<EvaluationLanguage, string[]> = {
  en: [
    'approach',
    'business model',
    'concept',
    'market',
    'method',
    'objective',
    'problem',
    'project',
    'solution',
    'strategy',
    'value proposition'
  ],
  fr: [
    'approche',
    'concept',
    'démarche',
    'enjeu',
    'marché',
    'méthode',
    'modèle',
    'objectif',
    'problème',
    'projet',
    'solution',
    'stratégie',
    'valeur'
  ]
};

const UNDERSTANDING_DECISION_HINTS: Record<EvaluationLanguage, string[]> = {
  en: [
    'choice',
    'chose',
    'decided',
    'option',
    'phase',
    'prioritize',
    'roadmap',
    'selected',
    'step'
  ],
  fr: [
    'choix',
    'décidé',
    'décision',
    'étape',
    'option',
    'phase',
    'priorité',
    'retenu',
    'sélectionné'
  ]
};

const UNDERSTANDING_EVIDENCE_HINTS: Record<EvaluationLanguage, string[]> = {
  en: ['benchmark', 'data', 'evidence', 'indicator', 'kpi', 'metric', 'result', 'roi'],
  fr: ['chiffre', 'donnée', 'indicateur', 'kpi', 'métrique', 'preuve', 'résultat', 'roi']
};

const UNDERSTANDING_RISK_HINTS: Record<EvaluationLanguage, string[]> = {
  en: ['assumption', 'constraint', 'limitation', 'risk', 'trade-off', 'tradeoff', 'uncertain'],
  fr: ['compromis', 'contrainte', 'hypothèse', 'incertitude', 'limite', 'risque']
};

const UNDERSTANDING_STRUCTURE_HINTS: Record<EvaluationLanguage, string[]> = {
  en: ['chapter', 'phase', 'section', 'slide', 'step'],
  fr: ['chapitre', 'diapo', 'phase', 'section', 'slide', 'étape']
};

type PresentationThemeRule = {
  decisionPrompt: {
    en: string;
    fr: string;
  };
  evidencePrompt: {
    en: string;
    fr: string;
  };
  id: string;
  keywords: string[];
  label: {
    en: string;
    fr: string;
  };
  riskPrompt: {
    en: string;
    fr: string;
  };
};

const PRESENTATION_THEME_RULES: PresentationThemeRule[] = [
  {
    decisionPrompt: {
      en: 'the prioritization of navigation and learning-journey improvements',
      fr: 'la priorisation des améliorations de navigation et de progression'
    },
    evidencePrompt: {
      en: 'the usage findings on modules and content access',
      fr: "les constats d’usage sur les modules et l’accès au contenu"
    },
    id: 'learning_platform',
    keywords: [
      'boostcamp',
      'content',
      'course',
      'download',
      'e-learning',
      'interface',
      'journey',
      'learning',
      'module',
      'navigation',
      'progress',
      'tracking'
    ],
    label: {
      en: 'improving the learning experience on a digital platform',
      fr: "l’amélioration de l’expérience d’apprentissage sur une plateforme numérique"
    },
    riskPrompt: {
      en: 'the feasibility of implementing product and UX improvements',
      fr: 'la faisabilité de mise en oeuvre des améliorations produit et UX'
    }
  },
  {
    decisionPrompt: {
      en: 'the choice of an energy-autonomous hotel model',
      fr: 'le choix d’un modèle d’hôtel autonome en énergie'
    },
    evidencePrompt: {
      en: 'the presented elements on energy production and consumption',
      fr: "les éléments présentés sur la production et la consommation d’énergie"
    },
    id: 'hotel_sustainability',
    keywords: [
      'chambre',
      'client',
      'consommation',
      'durable',
      'douche',
      'empreinte',
      'energie',
      'energy',
      'hotel',
      'hôtel',
      'symbiotique'
    ],
    label: {
      en: 'a sustainable hotel concept based on energy autonomy',
      fr: 'un concept hôtelier durable fondé sur l’autonomie énergétique'
    },
    riskPrompt: {
      en: 'the technical and economic viability of the hotel model',
      fr: 'la viabilité technique et économique du modèle hôtelier'
    }
  },
  {
    decisionPrompt: {
      en: 'the prioritization of key administrative steps in the student journey',
      fr: 'la priorisation des démarches administratives du parcours étudiant'
    },
    evidencePrompt: {
      en: 'the administrative steps and institutional actors identified',
      fr: 'les étapes administratives et acteurs institutionnels identifiés'
    },
    id: 'student_admin',
    keywords: [
      'attestation',
      'campus',
      'consulate',
      'consulat',
      'france',
      'inscription',
      'serviceetudiant',
      'student',
      'taxes',
      'visa'
    ],
    label: {
      en: 'structuring the administrative journey of international students',
      fr: "la structuration du parcours administratif d’étudiants internationaux"
    },
    riskPrompt: {
      en: 'dependency on institutional timelines and administrative requirements',
      fr: 'la dépendance aux délais et exigences institutionnelles'
    }
  },
  {
    decisionPrompt: {
      en: 'the choice of dashboard-driven sales management',
      fr: 'le choix d’un pilotage commercial basé sur un tableau de bord'
    },
    evidencePrompt: {
      en: 'the presented sales, revenue, and cost indicators',
      fr: 'les indicateurs de ventes, de revenus et de coûts présentés'
    },
    id: 'sales_dashboard',
    keywords: [
      'commission',
      'cost',
      'customer',
      'dashboard',
      'engagement',
      'kpi',
      'metrics',
      'pricing',
      'profitability',
      'revenue',
      'sales',
      'sunrun'
    ],
    label: {
      en: 'optimizing sales performance through metrics-driven management',
      fr: 'l’optimisation de la performance commerciale via un pilotage par indicateurs'
    },
    riskPrompt: {
      en: 'the ability to turn indicators into effective commercial actions',
      fr: 'la capacité à transformer les indicateurs en actions commerciales efficaces'
    }
  }
];

const CHALLENGE_ANCHOR_BLOCKLIST_PATTERNS = [
  /\btest questions challenge\b/i,
  /\bsend attestation inscription\b/i,
  /\b(?:presented|submitted)\s+by\b/i,
  /\b(?:présenté|présentée)\s+par\b/i
];

const CHALLENGE_ANCHOR_METADATA_TERMS = new Set([
  'attestation',
  'challenge',
  'class',
  'email',
  'group',
  'groupe',
  'inscription',
  'member',
  'members',
  'nom',
  'noms',
  'name',
  'names',
  'presented',
  'presentation',
  'presenter',
  'presenters',
  'professor',
  'question',
  'questions',
  'sales',
  'session',
  'student',
  'students',
  'submission',
  'submitted',
  'team',
  'teacher'
]);

const CHALLENGE_ANCHOR_ACTION_HINTS = new Set([
  'alimente',
  'alimenter',
  'appear',
  'appears',
  'adopted',
  'adopte',
  'adoptée',
  'adoptes',
  'analyse',
  'analyze',
  'build',
  'built',
  'calcule',
  'calculé',
  'choisi',
  'choisie',
  'choisies',
  'chose',
  'compares',
  'compare',
  'conclut',
  'conclude',
  'defend',
  'défend',
  'develop',
  'developed',
  'est',
  'explain',
  'explique',
  'impact',
  'implique',
  'improve',
  'improves',
  'improved',
  'increase',
  'increases',
  'is',
  'justifie',
  'justify',
  'measure',
  'mesure',
  'montre',
  'optimize',
  'permet',
  'propose',
  'proposé',
  'produit',
  'produite',
  'réduit',
  'reduce',
  'trigger',
  'triggers',
  'shows',
  'sont',
  'supports',
  'use',
  'used',
  'utilise',
  'value'
]);

const FR_ANCHOR_MARKERS = new Set([
  'de',
  'des',
  'du',
  'et',
  'la',
  'le',
  'les',
  'avec',
  'choix',
  'comment',
  'contexte',
  'données',
  'enjeux',
  'entre',
  'impact',
  'méthode',
  'modèle',
  'objectif',
  'pour',
  'preuve',
  'projet',
  'question',
  'résultat',
  'solution',
  'stratégie',
  'sur',
  'vous'
]);

const EN_ANCHOR_MARKERS = new Set([
  'access',
  'activity',
  'active',
  'and',
  'between',
  'clear',
  'coaching',
  'company',
  'course',
  'customer',
  'data',
  'digital',
  'efficiency',
  'employees',
  'engagement',
  'evidence',
  'for',
  'from',
  'immediate',
  'learning',
  'leading',
  'main',
  'module',
  'modules',
  'page',
  'performance',
  'produc',
  'pricing',
  'progress',
  'score',
  'scores',
  'section',
  'sections',
  'step',
  'strategies',
  'strategy',
  'significantly',
  'strong',
  'support',
  'the',
  'tracking',
  'trigger',
  'urgent',
  'validation',
  'want',
  'with',
  'impact',
  'method',
  'model',
  'objective',
  'project',
  'proof',
  'question',
  'result',
  'solution',
  'strategy',
  'tradeoff'
]);

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

function isSafeQuestionAnchor(
  value: string | null | undefined,
  language: EvaluationLanguage
) {
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

  const wordCount = tokenizeWords(normalized).length;
  if (wordCount < 3) {
    return false;
  }

  if (wordCount > 8) {
    return false;
  }

  if (looksLikeRosterOrCoverAnchor(normalized)) {
    return false;
  }

  const words = tokenizeWords(normalized);
  if (looksLikeForeignLanguageAnchor(words, language)) {
    return false;
  }

  return true;
}

function looksLikeRosterOrCoverAnchor(value: string) {
  if (CHALLENGE_ANCHOR_BLOCKLIST_PATTERNS.some((pattern) => pattern.test(value))) {
    return true;
  }

  if (/\b(?:https?:\/\/|www\.|@)\S+/i.test(value)) {
    return true;
  }

  const words = tokenizeWords(value);
  if (words.length < 4) {
    return false;
  }

  const metadataHits = words.filter((word) =>
    CHALLENGE_ANCHOR_METADATA_TERMS.has(word)
  ).length;
  const actionHits = words.filter((word) =>
    CHALLENGE_ANCHOR_ACTION_HINTS.has(word)
  ).length;

  if (metadataHits >= 2 && actionHits === 0) {
    return true;
  }

  if (metadataHits >= 1 && actionHits === 0 && words.length >= 6) {
    return true;
  }

  if (metadataHits === 0 && actionHits === 0 && words.length >= 8) {
    return true;
  }

  return false;
}

function looksLikeForeignLanguageAnchor(words: string[], language: EvaluationLanguage) {
  if (words.length < 4) {
    return false;
  }

  const frHits = words.filter((word) => FR_ANCHOR_MARKERS.has(word)).length;
  const enHits = words.filter((word) => EN_ANCHOR_MARKERS.has(word)).length;

  if (language === 'fr') {
    return enHits >= 2 && frHits === 0;
  }

  return frHits >= 2 && enHits === 0;
}

function looksLikeNameListFragment(value: string) {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return false;
  }

  if (/[.!?]/.test(compact)) {
    return false;
  }

  const words = tokenizeWords(compact);
  if (words.length < 5 || words.length > 16) {
    return false;
  }

  const titleCaseWords = compact.match(/\b[A-ZÀ-Ý][a-zà-ÿ]{2,}\b/g) ?? [];
  const uppercaseWords = compact.match(/\b[A-ZÀ-Ý]{3,}\b/g) ?? [];
  const lowerCaseWords = compact.match(/\b[a-zà-ÿ]{3,}\b/g) ?? [];

  if (titleCaseWords.length >= 4 && lowerCaseWords.length <= 2) {
    return true;
  }

  if (titleCaseWords.length >= 3 && uppercaseWords.length >= 1 && lowerCaseWords.length <= 3) {
    return true;
  }

  return false;
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
    if (looksLikeNameListFragment(fragment)) {
      continue;
    }

    const quotedMatches = [...fragment.matchAll(/[“"«](.{8,140}?)[”"»]/g)];

    for (const match of quotedMatches) {
      const quote = match[1]?.trim() ?? '';
      if (!quote) {
        continue;
      }

      const focusedQuote = trimQuestionFocus(quote, language);
      if (isSafeQuestionAnchor(focusedQuote, language) && !anchors.includes(focusedQuote)) {
        anchors.push(focusedQuote);
      }
    }
  }

  for (const fragment of fragments) {
    if (looksLikeNameListFragment(fragment)) {
      continue;
    }

    if (!/(slide|diapo|page|section|partie)\s*\d*/i.test(fragment)) {
      continue;
    }

    const focusedFragment = trimQuestionFocus(fragment, language);
    if (isSafeQuestionAnchor(focusedFragment, language) && !anchors.includes(focusedFragment)) {
      anchors.push(focusedFragment);
    }
  }

  for (const fragment of fragments) {
    if (looksLikeNameListFragment(fragment)) {
      continue;
    }

    if (tokenizeWords(fragment).length < 4) {
      continue;
    }

    const focusedFragment = trimQuestionFocus(fragment, language);
    if (isSafeQuestionAnchor(focusedFragment, language) && !anchors.includes(focusedFragment)) {
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
    if (isSafeQuestionAnchor(candidate, language)) {
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
    .filter((sentence) => tokenizeWords(sentence).length >= 6 && !looksLikeNameListFragment(sentence))
    .map((sentence) => trimQuestionFocus(sentence, language))
    .filter((sentence) => isSafeQuestionAnchor(sentence, language))
    .filter(Boolean);
  const teacherContent = input.teacherComments?.trim() ?? '';
  const teacherConcreteAnchors = extractConcreteChallengeAnchors(teacherContent, language);
  const teacherSentences = splitSentences(teacherContent)
    .filter((sentence) => tokenizeWords(sentence).length >= 4 && !looksLikeNameListFragment(sentence))
    .map((sentence) => trimQuestionFocus(sentence, language))
    .filter((sentence) => isSafeQuestionAnchor(sentence, language))
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

function hasKeywordHint(value: string, hints: string[]) {
  const normalized = stripDiacritics(value).toLowerCase();
  return hints.some((hint) => normalized.includes(stripDiacritics(hint).toLowerCase()));
}

function hasLikelySentenceShape(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return false;
  }

  if (normalized.length < 18 || normalized.length > 240) {
    return false;
  }

  if (/\b(?:https?:\/\/|www\.|@)\S+/i.test(normalized)) {
    return false;
  }

  const words = tokenizeWords(normalized);
  if (words.length < 4) {
    return false;
  }

  const readableWords = words.filter((word) => word.length >= 3);
  if (readableWords.length < 3) {
    return false;
  }

  return true;
}

function sanitizeUnderstandingPhrase(
  value: string | null | undefined,
  language: EvaluationLanguage
) {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized) {
    return null;
  }

  if (!hasLikelySentenceShape(normalized)) {
    return null;
  }

  if (looksLikeNameListFragment(normalized) || looksLikeRosterOrCoverAnchor(normalized)) {
    return null;
  }

  const focused = trimQuestionFocus(normalized, language);
  const words = tokenizeWords(focused);
  if (words.length < 3 || words.length > 12) {
    return null;
  }

  if (looksLikeForeignLanguageAnchor(words, language)) {
    return null;
  }

  return focused.replace(/\s+/g, ' ').trim();
}

function extractUnderstandingFragments(
  input: EvaluationChallengeQuestionInput,
  language: EvaluationLanguage
) {
  const source = [input.submissionText?.trim() ?? '', input.teacherComments?.trim() ?? '']
    .filter(Boolean)
    .join('\n');

  const fragments = Array.from(
    new Set(
      [
        ...splitSentences(source),
        ...source
          .replace(/\r/g, '\n')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      ]
        .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
        .filter(hasLikelySentenceShape)
        .filter((fragment) => !looksLikeNameListFragment(fragment))
        .filter((fragment) => !looksLikeRosterOrCoverAnchor(fragment))
    )
  );

  const uniquePhrases: string[] = [];
  for (const fragment of fragments) {
    const phrase = sanitizeUnderstandingPhrase(fragment, language);
    if (phrase && !uniquePhrases.includes(phrase)) {
      uniquePhrases.push(phrase);
    }
  }

  return uniquePhrases;
}

function pickBestUnderstandingPhrase(
  candidates: string[],
  language: EvaluationLanguage,
  categoryHints: string[]
) {
  const scored = candidates
    .map((candidate) => {
      const words = tokenizeWords(candidate);
      let score = 0;
      if (hasKeywordHint(candidate, categoryHints)) {
        score += 3;
      }
      if (hasKeywordHint(candidate, UNDERSTANDING_CONCEPT_HINTS[language])) {
        score += 2;
      }
      if (hasKeywordHint(candidate, UNDERSTANDING_EVIDENCE_HINTS[language])) {
        score += 1;
      }
      if (words.length >= 4 && words.length <= 9) {
        score += 1;
      }
      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score);

  return scored[0]?.candidate ?? null;
}

function collectUnderstandingPoints(
  candidates: string[],
  language: EvaluationLanguage,
  categoryHints: string[],
  limit: number
) {
  return candidates
    .filter((candidate) => hasKeywordHint(candidate, categoryHints))
    .map((candidate) => sanitizeUnderstandingPhrase(candidate, language))
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate, index, list) => list.indexOf(candidate) === index)
    .slice(0, limit);
}

function extractNamedEntities(candidates: string[]) {
  const entities = new Set<string>();

  for (const candidate of candidates) {
    const uppercaseMatches = candidate.match(/\b[A-Z]{2,}(?:\s+[A-Z]{2,}){0,2}\b/g) ?? [];
    for (const match of uppercaseMatches) {
      const normalized = match.trim();
      if (normalized.length >= 2 && normalized.length <= 32) {
        entities.add(normalized);
      }
    }

    const titleCaseMatches =
      candidate.match(/\b[A-ZÀ-Ý][a-zà-ÿ]{2,}(?:\s+[A-ZÀ-Ý][a-zà-ÿ]{2,}){0,2}\b/g) ?? [];
    for (const match of titleCaseMatches) {
      const normalized = match.trim();
      if (looksLikeNameListFragment(normalized)) {
        continue;
      }
      if (normalized.length >= 3 && normalized.length <= 40) {
        entities.add(normalized);
      }
    }
  }

  return Array.from(entities).slice(0, 4);
}

function normalizeForMatching(value: string) {
  return stripDiacritics(value).toLowerCase();
}

function detectPresentationTheme(
  input: EvaluationChallengeQuestionInput,
  language: EvaluationLanguage
) {
  const source = [input.submissionText?.trim() ?? '', input.teacherComments?.trim() ?? '']
    .filter(Boolean)
    .join('\n');
  const normalizedSource = normalizeForMatching(source);

  const scoredThemes = PRESENTATION_THEME_RULES.map((rule) => {
    const hits = rule.keywords.reduce(
      (count, keyword) =>
        normalizedSource.includes(normalizeForMatching(keyword)) ? count + 1 : count,
      0
    );
    return { hits, rule };
  }).sort((left, right) => right.hits - left.hits);

  const best = scoredThemes[0];
  if (!best || best.hits < 2) {
    return null;
  }

  return {
    decisionPrompt: best.rule.decisionPrompt[language],
    evidencePrompt: best.rule.evidencePrompt[language],
    id: best.rule.id,
    label: best.rule.label[language],
    riskPrompt: best.rule.riskPrompt[language],
    score: best.hits
  };
}

export function deriveChallengePresentationUnderstanding(
  input: EvaluationChallengeQuestionInput,
  language: EvaluationLanguage
): ChallengePresentationUnderstanding {
  const candidates = extractUnderstandingFragments(input, language);
  const theme = detectPresentationTheme(input, language);
  const preferredFallbackConcept = language === 'fr' ? 'la stratégie proposée' : 'the proposed strategy';
  const subjectCandidate = sanitizeUnderstandingPhrase(input.subject, language);
  const classCandidate = sanitizeUnderstandingPhrase(input.className, language);
  const fallbackMainConcept =
    theme?.label ??
    (subjectCandidate && hasKeywordHint(subjectCandidate, UNDERSTANDING_CONCEPT_HINTS[language])
      ? subjectCandidate
      : null) ??
    (classCandidate && hasKeywordHint(classCandidate, UNDERSTANDING_CONCEPT_HINTS[language])
      ? classCandidate
      : null) ??
    preferredFallbackConcept;
  const conceptCandidate = pickBestUnderstandingPhrase(
    candidates,
    language,
    UNDERSTANDING_CONCEPT_HINTS[language]
  );
  const conceptCandidateWords = tokenizeWords(conceptCandidate ?? '');
  const conceptCandidateLooksForeign = conceptCandidate
    ? looksLikeForeignLanguageAnchor(conceptCandidateWords, language)
    : false;
  const conceptCandidateHasConceptSignal = conceptCandidate
    ? hasKeywordHint(conceptCandidate, UNDERSTANDING_CONCEPT_HINTS[language])
    : false;
  const conceptCandidateHasFrenchSignal =
    language === 'fr' && conceptCandidate
      ? /[àâçéèêëîïôùûüÿœæ]/i.test(conceptCandidate) ||
        conceptCandidateWords.some((word) => FR_ANCHOR_MARKERS.has(word))
      : true;
  const conceptFromCandidate =
    conceptCandidate &&
    !conceptCandidateLooksForeign &&
    conceptCandidateHasConceptSignal &&
    conceptCandidateHasFrenchSignal
      ? conceptCandidate
      : fallbackMainConcept;
  const mainConcept = theme?.label ?? conceptFromCandidate;
  const detectedKeyDecisions = collectUnderstandingPoints(
    candidates,
    language,
    UNDERSTANDING_DECISION_HINTS[language],
    3
  );
  const detectedEvidencePoints = collectUnderstandingPoints(
    candidates,
    language,
    UNDERSTANDING_EVIDENCE_HINTS[language],
    3
  );
  const detectedRisksOrTradeoffs = collectUnderstandingPoints(
    candidates,
    language,
    UNDERSTANDING_RISK_HINTS[language],
    2
  );
  const detectedPresentationStructure = collectUnderstandingPoints(
    candidates,
    language,
    UNDERSTANDING_STRUCTURE_HINTS[language],
    3
  );
  const keyDecisions =
    detectedKeyDecisions.length > 0
      ? detectedKeyDecisions
      : theme
        ? [theme.decisionPrompt]
        : [];
  const evidencePoints =
    detectedEvidencePoints.length > 0
      ? detectedEvidencePoints
      : theme
        ? [theme.evidencePrompt]
        : [];
  const risksOrTradeoffs =
    detectedRisksOrTradeoffs.length > 0
      ? detectedRisksOrTradeoffs
      : theme
        ? [theme.riskPrompt]
        : [];
  const presentationStructure =
    detectedPresentationStructure.length > 0
      ? detectedPresentationStructure
      : [];
  const namedEntities = extractNamedEntities(candidates).filter(
    (entity) => !CHALLENGE_ANCHOR_BLOCKLIST_PATTERNS.some((pattern) => pattern.test(entity))
  );
  const summaryTopic = mainConcept;
  const summary =
    language === 'fr'
      ? `Le groupe présente ${summaryTopic}.`
      : `The group presents ${summaryTopic}.`;

  return {
    evidencePoints,
    keyDecisions,
    mainConcept,
    namedEntities,
    presentationStructure,
    risksOrTradeoffs,
    summary
  };
}

export function buildChallengeQuestions(
  input: EvaluationChallengeQuestionInput,
  language: EvaluationLanguage,
  options?: {
    previousQuestions?: string[] | null;
    variationSeed?: string | null;
  }
) {
  const understanding = deriveChallengePresentationUnderstanding(input, language);
  const mainConcept = understanding.mainConcept;
  const keyDecision = understanding.keyDecisions[0] ?? mainConcept;
  const evidencePoint = understanding.evidencePoints[0] ?? null;
  const riskPoint = understanding.risksOrTradeoffs[0] ?? null;
  const previousQuestions = options?.previousQuestions?.map((entry) => entry.trim()).filter(Boolean) ?? [];
  const normalizedPrevious = previousQuestions.map((entry) => stripDiacritics(entry).toLowerCase());
  const variantIndex = selectChallengeQuestionVariantIndex({
    language,
    previousQuestions,
    variationSeed: options?.variationSeed ?? null
  });

  const chooseUnused = (candidates: string[]) => {
    for (const candidate of candidates) {
      const normalizedCandidate = stripDiacritics(candidate).toLowerCase();
      if (!normalizedPrevious.includes(normalizedCandidate)) {
        return candidate;
      }
    }
    return candidates[0] ?? '';
  };

  if (language === 'fr') {
    const q1Candidates = [
      `Quel problème principal votre projet cherche-t-il à résoudre autour de ${mainConcept}, et quels éléments concrets de votre présentation soutiennent ce diagnostic ?`,
      `Dans votre proposition sur ${mainConcept}, quelle décision a le plus d’impact sur la faisabilité, et comment la justifiez-vous devant le jury ?`,
      `Sur ${mainConcept}, quel besoin prioritaire avez-vous choisi de traiter en premier, et sur quelles preuves de votre présentation vous appuyez-vous ?`
    ];
    const q2Candidates = [
      `Pourquoi avez-vous retenu ${keyDecision} plutôt qu’une option plus simple, et quel compromis cela implique-t-il ?`,
      `En quoi ${keyDecision} est-elle cohérente avec vos objectifs, et quelle limite importante acceptez-vous avec ce choix ?`,
      `Si vous deviez défendre ${keyDecision} face à une alternative concurrente, quels arguments tirés de votre présentation mettriez-vous en avant ?`
    ];
    const q3Candidates = evidencePoint
      ? [
          `Quels indicateurs ou arguments précis présentés dans ${evidencePoint} permettent de défendre la crédibilité de votre proposition ?`,
          `Parmi les éléments cités dans ${evidencePoint}, lequel est le plus convaincant pour prouver la viabilité de votre projet, et pourquoi ?`,
          `Comment transformez-vous les informations de ${evidencePoint} en preuve solide de performance ou d’impact ?`
        ]
      : riskPoint
        ? [
            `Quelle hypothèse de votre projet liée à ${riskPoint} vous semble la plus fragile, et comment la défendriez-vous devant le jury ?`,
            `Quel risque associé à ${riskPoint} pourrait remettre en cause votre proposition, et quel plan d’atténuation présenteriez-vous ?`,
            `Si ${riskPoint} était contesté, quelle démonstration concrète pourriez-vous apporter pour maintenir la crédibilité du projet ?`
          ]
        : [
            `Quelle hypothèse de votre projet vous semble la plus fragile, et comment la défendriez-vous devant le jury ?`,
            `Quel point critique de votre proposition nécessiterait une justification supplémentaire pour convaincre un jury exigeant ?`,
            `Quel compromis central de votre projet pourrait être contesté, et comment le défendriez-vous avec des éléments concrets ?`
          ];

    return [
      chooseUnused([q1Candidates[variantIndex] ?? q1Candidates[0], ...q1Candidates]),
      chooseUnused([q2Candidates[variantIndex] ?? q2Candidates[0], ...q2Candidates]),
      chooseUnused([q3Candidates[variantIndex] ?? q3Candidates[0], ...q3Candidates])
    ];
  }

  const q1Candidates = [
    `What core problem is your project trying to solve around ${mainConcept}, and which concrete elements in your presentation support that diagnosis?`,
    `Within your ${mainConcept} proposal, which decision has the strongest impact on feasibility, and how would you justify it to the jury?`,
    `For ${mainConcept}, which priority need did you choose to address first, and what evidence from your presentation supports that choice?`
  ];
  const q2Candidates = [
    `Why did you choose ${keyDecision} instead of a simpler option, and what trade-off did that choice create?`,
    `How does ${keyDecision} align with your objectives, and which limitation are you intentionally accepting with that choice?`,
    `If you had to defend ${keyDecision} against a competing option, which arguments from your presentation would you use first?`
  ];
  const q3Candidates = evidencePoint
    ? [
        `Which indicators or arguments presented in ${evidencePoint} best defend the credibility of your proposal?`,
        `Among the elements in ${evidencePoint}, which one is most convincing for your project's viability, and why?`,
        `How do you turn the information in ${evidencePoint} into solid evidence of impact or performance?`
      ]
    : riskPoint
      ? [
          `Which assumption tied to ${riskPoint} seems most fragile, and how would you defend it in front of the jury?`,
          `What risk linked to ${riskPoint} could weaken your proposal, and what mitigation plan would you present?`,
          `If ${riskPoint} were challenged, what concrete demonstration would you provide to preserve your project's credibility?`
        ]
      : [
          'Which assumption in your project seems most fragile, and how would you defend it in front of the jury?',
          'Which critical point in your proposal would need stronger justification to convince a demanding jury?',
          'What central trade-off in your project could be challenged, and how would you defend it with concrete evidence?'
        ];

  return [
    chooseUnused([q1Candidates[variantIndex] ?? q1Candidates[0], ...q1Candidates]),
    chooseUnused([q2Candidates[variantIndex] ?? q2Candidates[0], ...q2Candidates]),
    chooseUnused([q3Candidates[variantIndex] ?? q3Candidates[0], ...q3Candidates])
  ];
}

function selectChallengeQuestionVariantIndex(params: {
  language: EvaluationLanguage;
  previousQuestions: string[];
  variationSeed: string | null;
}) {
  const variantCount = 3;
  const seed = [params.language, params.variationSeed ?? '', params.previousQuestions.join('|')].join('|');
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % variantCount;
}

export function getChallengeQuestionAnchorDebug(
  input: EvaluationChallengeQuestionInput,
  language: EvaluationLanguage
): ChallengeQuestionAnchorDebug {
  const understanding = deriveChallengePresentationUnderstanding(input, language);
  const topicFocus = understanding.mainConcept;
  const primaryAnchor = understanding.mainConcept;
  const secondaryAnchor = understanding.keyDecisions[0] ?? understanding.mainConcept;
  const critiqueAnchor =
    understanding.risksOrTradeoffs[0] ??
    understanding.evidencePoints[0] ??
    understanding.mainConcept;
  const submissionAnchorCandidates = Array.from(
    new Set([
      understanding.mainConcept,
      ...understanding.keyDecisions,
      ...understanding.evidencePoints,
      ...understanding.risksOrTradeoffs,
      ...understanding.presentationStructure,
      ...understanding.namedEntities
    ])
  ).slice(0, 8);

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
