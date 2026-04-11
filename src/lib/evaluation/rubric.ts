import { and, asc, desc, eq } from 'drizzle-orm';

import { db, rubricCriteria, rubrics } from '@/db';

export const PAIRAGOGIE_RUBRIC_TITLE = 'EVALUATION COMPETENCES (PAIRAGOGIE)';

export const PAIRAGOGIE_RUBRIC_CRITERIA = [
  {
    description: null,
    label: "Contextualisation et qualité de l'introduction",
    maxScore: 1,
    sortOrder: 0
  },
  {
    description: null,
    label: 'Qualité globale et analyse critique',
    maxScore: 2,
    sortOrder: 1
  },
  {
    description: null,
    label: "Pertinence de la stratégie et cohérence du plan d'action",
    maxScore: 1,
    sortOrder: 2
  },
  {
    description: null,
    label: 'Mise en œuvre des compétences métiers/rncp',
    maxScore: 3,
    sortOrder: 3
  },
  {
    description: null,
    label: "Clarté de l’introduction, progression logique, synthèse de conclusion",
    maxScore: 2,
    sortOrder: 4
  },
  {
    description: null,
    label: 'Équilibre du temps de parole, transitions fluides entre intervenants',
    maxScore: 2,
    sortOrder: 5
  },
  {
    description: null,
    label: 'Respect du temps imparti, rythme adapté',
    maxScore: 1,
    sortOrder: 6
  },
  {
    description: null,
    label: "Qualité de l’argumentation en réponse aux questions de l'intervenant",
    maxScore: 2,
    sortOrder: 7
  },
  {
    description: null,
    label: 'Compréhension et connaissance du contenu présenté',
    maxScore: 2,
    sortOrder: 8
  },
  {
    description: null,
    label: 'Langage clair, fluide, adapté au niveau professionnel et académique',
    maxScore: 1,
    sortOrder: 9
  },
  {
    description: null,
    label: 'Intonation, regard, posture, assurance dans la prise de parole',
    maxScore: 1,
    sortOrder: 10
  },
  {
    description: null,
    label:
      'Feedback des pairs (Dynamique, Questions, Balance des avis positifs et négatifs formulés par les groupes non concurrents, esprit collaboratif)',
    maxScore: 2,
    sortOrder: 11
  }
] as const;

export type PairagogieRubricCriterionSnapshot = {
  description: string | null;
  id: string;
  label: string;
  maxScore: number;
  sortOrder: number;
};

export type PairagogieRubricSnapshot = {
  criteria: PairagogieRubricCriterionSnapshot[];
  id: string;
  title: string;
};

async function insertCanonicalCriteria(rubricId: string, missingSortOrders: number[] | null = null) {
  const criteriaToInsert =
    missingSortOrders === null
      ? PAIRAGOGIE_RUBRIC_CRITERIA
      : PAIRAGOGIE_RUBRIC_CRITERIA.filter((criterion) => missingSortOrders.includes(criterion.sortOrder));

  if (criteriaToInsert.length === 0) {
    return;
  }

  const now = new Date();
  await db.insert(rubricCriteria).values(
    criteriaToInsert.map((criterion) => ({
      description: criterion.description,
      label: criterion.label,
      maxScore: criterion.maxScore,
      rubricId,
      sortOrder: criterion.sortOrder,
      updatedAt: now
    }))
  );
}

export async function ensurePairagogieRubric(sessionId: string): Promise<PairagogieRubricSnapshot> {
  const rubricRows = await db
    .select({
      id: rubrics.id,
      title: rubrics.title,
      updatedAt: rubrics.updatedAt
    })
    .from(rubrics)
    .where(and(eq(rubrics.sessionId, sessionId), eq(rubrics.isActive, true)))
    .orderBy(desc(rubrics.updatedAt), desc(rubrics.createdAt), desc(rubrics.id));

  let rubric = rubricRows[0] ?? null;

  if (!rubric) {
    const inserted = await db
      .insert(rubrics)
      .values({
        instructions: null,
        isActive: true,
        sessionId,
        title: PAIRAGOGIE_RUBRIC_TITLE,
        updatedAt: new Date()
      })
      .returning({
        id: rubrics.id,
        title: rubrics.title,
        updatedAt: rubrics.updatedAt
      });

    rubric = inserted[0] ?? null;
    if (!rubric) {
      throw new Error('Could not create the default Pairagogie rubric.');
    }

    await insertCanonicalCriteria(rubric.id);
  } else if (rubricRows.length > 1) {
    const extraRubricIds = rubricRows.slice(1).map((row) => row.id);
    for (const extraRubricId of extraRubricIds) {
      await db
        .update(rubrics)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(rubrics.id, extraRubricId));
    }
  }

  const criteriaRows = await db
    .select({
      description: rubricCriteria.description,
      id: rubricCriteria.id,
      label: rubricCriteria.label,
      maxScore: rubricCriteria.maxScore,
      sortOrder: rubricCriteria.sortOrder
    })
    .from(rubricCriteria)
    .where(eq(rubricCriteria.rubricId, rubric.id))
    .orderBy(asc(rubricCriteria.sortOrder));

  if (criteriaRows.length === 0) {
    await insertCanonicalCriteria(rubric.id);
  } else {
    const existingSortOrders = new Set(criteriaRows.map((criterion) => criterion.sortOrder));
    const missingSortOrders = PAIRAGOGIE_RUBRIC_CRITERIA.filter(
      (criterion) => !existingSortOrders.has(criterion.sortOrder)
    ).map((criterion) => criterion.sortOrder);

    if (missingSortOrders.length > 0) {
      await insertCanonicalCriteria(rubric.id, missingSortOrders);
    }
  }

  const refreshedCriteriaRows = await db
    .select({
      description: rubricCriteria.description,
      id: rubricCriteria.id,
      label: rubricCriteria.label,
      maxScore: rubricCriteria.maxScore,
      sortOrder: rubricCriteria.sortOrder
    })
    .from(rubricCriteria)
    .where(eq(rubricCriteria.rubricId, rubric.id))
    .orderBy(asc(rubricCriteria.sortOrder));

  return {
    criteria: refreshedCriteriaRows.map((criterion) => ({
      description: criterion.description,
      id: criterion.id,
      label: criterion.label,
      maxScore: criterion.maxScore,
      sortOrder: criterion.sortOrder
    })),
    id: rubric.id,
    title: rubric.title
  };
}
