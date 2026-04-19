'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { saveSessionInstructionsAction } from '@/app/sessions/actions';
import { CollapsiblePanel } from '@/components/collapsible-panel';
import { EvaluationRosterDialog } from '@/components/evaluation-roster-dialog';
import { GroupSubmissionDropzone } from '@/components/group-submission-dropzone';
import { RandomizeOrderButton } from '@/components/randomize-order-button';
import { formatFeedbackSections } from '@/lib/evaluation/engine';
import type {
  EvaluationAiCriterionRecommendation,
  EvaluationAiFeedbackSections,
  EvaluationAiStatus,
  EvaluationCriterionRow,
  EvaluationGroupMember
} from '@/lib/evaluation/types';

type SerializableGroup = {
  aiGeneratedAt: string | null;
  aiLastError: string | null;
  aiRecommendedCriteria: EvaluationAiCriterionRecommendation[];
  aiRecommendedFeedback: EvaluationAiFeedbackSections | null;
  aiRecommendedQuestions: string[];
  aiStatus: EvaluationAiStatus;
  aiStatusUpdatedAt: string | null;
  capacity: number;
  criteria: EvaluationCriterionRow[];
  evaluationId: string | null;
  finalFeedback: string;
  finalFeedbackSections: EvaluationAiFeedbackSections;
  groupId: string;
  groupName: string;
  members: EvaluationGroupMember[];
  presentationComments: string;
  presentationOrder: number | null;
  qaComments: string;
  readyForFinalization: boolean;
  submittedAt: string | null;
  submissionId: string | null;
  submissionContent: string | null;
  submissionTitle: string | null;
  totalScore: number | null;
};

type EvaluationWorkspaceClientProps = {
  groups: SerializableGroup[];
  initialGroupId: string;
  sessionId: string;
  sessionLanguage: string;
  sessionInstructions: string | null;
};

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'failed'; message: string };

type CriteriaDraft = EvaluationCriterionRow & {
  score: number | null;
};

type GroupDraft = SerializableGroup & {
  criteria: CriteriaDraft[];
};

type PanelState = {
  challengeOpen: boolean;
  gradingOpen: boolean;
  notesOpen: boolean;
};

type BatchState = {
  kind: 'idle' | 'running' | 'done' | 'failed';
  message: string;
};

function buildFeedbackString(sections: EvaluationAiFeedbackSections, language: string) {
  return formatFeedbackSections(sections, language);
}

function getTimestampLabel(value: string | null) {
  if (!value) {
    return 'Not saved yet';
  }

  return new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function scoreStateLabel(state: SaveState) {
  switch (state.kind) {
    case 'failed':
      return `Save failed: ${state.message}`;
    case 'saved':
      return `Saved ${getTimestampLabel(state.at)}`;
    case 'saving':
      return 'Saving...';
    default:
      return 'Idle';
  }
}

function formatScoreTotal(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function safeTrim(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 192 192"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m104.175 90.97-4.252 38.384 38.383-4.252L247.923 15.427V2.497L226.78-18.646h-12.93zm98.164-96.96 31.671 31.67"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="12"
        transform="translate(-77.923 40.646)"
      />
      <path
        d="m195.656 33.271-52.882 52.882"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="5"
        strokeWidth="12"
        transform="translate(-77.923 40.646)"
      />
    </svg>
  );
}

function extractGroupNumber(groupName: string) {
  const normalized = groupName.replace(/\s+/g, ' ').trim();
  const patterns = [
    /\b(?:group|groupe)\s*0*([1-9]\d*)\b/iu,
    /\bclasse\s*\d+\s*-\s*g\s*0*([1-9]\d*)\b/iu,
    /\bg\s*0*([1-9]\d*)\b/iu
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
  }

  return null;
}

function formatGroupDisplayName(groupName: string, fallbackNumber: number) {
  const groupNumber = extractGroupNumber(groupName) ?? fallbackNumber;
  return `Group ${groupNumber}`;
}

function sortGroupsByPresentationOrder(groups: GroupDraft[]) {
  return groups
    .map((group, index) => ({ group, index }))
    .sort((left, right) => {
      const leftOrder = left.group.presentationOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.group.presentationOrder ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.index - right.index;
    })
    .map(({ group }) => group);
}

function reorderGroupsByIds(groups: GroupDraft[], orderedGroupIds: string[]) {
  const groupsById = new Map(groups.map((group) => [group.groupId, group]));
  const orderedGroups = orderedGroupIds
    .map((groupId) => groupsById.get(groupId))
    .filter((group): group is GroupDraft => Boolean(group));
  const remainingGroups = groups.filter((group) => !orderedGroupIds.includes(group.groupId));

  return [...orderedGroups, ...remainingGroups];
}

function initialDraftGroups(groups: SerializableGroup[]) {
  return groups.map((group) => ({
    ...group,
    criteria: group.criteria.map((criterion) => ({ ...criterion }))
  }));
}

function initialPanelStates(groups: SerializableGroup[]) {
  return Object.fromEntries(
    groups.map((group) => {
      return [
        group.groupId,
        {
          challengeOpen: true,
          gradingOpen: false,
          notesOpen: true
        } satisfies PanelState
      ];
    })
  ) as Record<string, PanelState>;
}

export function EvaluationWorkspaceClient({
  groups: initialGroups,
  initialGroupId,
  sessionId,
  sessionInstructions,
  sessionLanguage
}: EvaluationWorkspaceClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<GroupDraft[]>(() => initialDraftGroups(initialGroups));
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [panelStates, setPanelStates] = useState<Record<string, PanelState>>(() =>
    initialPanelStates(initialGroups)
  );
  const [spellcheckReady, setSpellcheckReady] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialGroups.map((group) => [group.groupId, false]))
  );
  const [challengeQuestionsBatchState, setChallengeQuestionsBatchState] = useState<BatchState>({
    kind: 'idle',
    message: ''
  });
  const [gradingBatchState, setGradingBatchState] = useState<BatchState>({
    kind: 'idle',
    message: ''
  });
  const [challengeQuestionsSkipped, setChallengeQuestionsSkipped] = useState<Record<string, string>>(
    {}
  );
  const [rosterGroupId, setRosterGroupId] = useState<string | null>(null);
  const [draggedTabGroupId, setDraggedTabGroupId] = useState<string | null>(null);
  const [dropTargetTabGroupId, setDropTargetTabGroupId] = useState<string | null>(null);
  const [presentationOrderSaving, setPresentationOrderSaving] = useState(false);
  const [presentationOrderError, setPresentationOrderError] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const activeFeedbackGroupIdRef = useRef<string | null>(null);
  const editingGroupNameInputRef = useRef<HTMLInputElement | null>(null);
  const renameBlurActionRef = useRef<'save' | 'cancel' | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>(() =>
    Object.fromEntries(
      initialGroups.map((group) => [
        group.groupId,
        group.evaluationId || group.presentationComments || group.qaComments || group.finalFeedback
          ? ({ kind: 'saved', at: group.aiStatusUpdatedAt ?? group.aiGeneratedAt ?? group.submittedAt ?? new Date().toISOString() } as SaveState)
          : ({ kind: 'idle' } as SaveState)
      ])
    )
  );
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const requestVersions = useRef<Record<string, number>>({});

  useEffect(() => {
    setGroups((current) => {
      let changed = false;
      const nextGroups = current.map((group) => {
        const incoming = initialGroups.find((entry) => entry.groupId === group.groupId);
        if (!incoming) {
          return group;
        }

        const needsUpdate =
          incoming.presentationOrder !== group.presentationOrder ||
          incoming.groupName !== group.groupName;

        if (!needsUpdate) {
          return group;
        }

        changed = true;
        return {
          ...group,
          groupName: incoming.groupName,
          presentationOrder: incoming.presentationOrder
        };
      });

      return changed ? nextGroups : current;
    });
  }, [initialGroups]);

  useEffect(() => {
    if (!editingGroupId) {
      return;
    }

    editingGroupNameInputRef.current?.focus();
    editingGroupNameInputRef.current?.select();
  }, [editingGroupId]);

  const tabGroups = sortGroupsByPresentationOrder(groups);
  const displayGroups = tabGroups.map((group) => ({
    ...group,
    groupName: safeTrim(group.groupName)
  }));
  const selectedGroup =
    tabGroups.find((group) => group.groupId === selectedGroupId) ?? tabGroups[0] ?? null;
  const selectedGroupPanelState = selectedGroup ? panelStates[selectedGroup.groupId] : null;
  const challengeOpen = selectedGroupPanelState?.challengeOpen ?? true;
  const notesOpen = selectedGroupPanelState?.notesOpen ?? true;
  const gradingOpen = selectedGroupPanelState?.gradingOpen ?? false;
  const selectedGroupHasUploadedWork = Boolean(selectedGroup?.submissionId);
  const selectedGroupHasFeedbackInputs = Boolean(
    selectedGroup?.presentationComments.trim() || selectedGroup?.submissionContent?.trim()
  );
  const selectedGroupHasChallengeQuestions = Boolean(selectedGroup?.aiRecommendedQuestions.length);
  const selectedGroupCanSpellCheck = Boolean(
    selectedGroup?.aiRecommendedFeedback && spellcheckReady[selectedGroup?.groupId ?? '']
  );
  const tabGroupsForRandomization = displayGroups.map((group) => ({
    groupId: group.groupId,
    groupName: group.groupName
  }));
  const tabGroupIds = tabGroups.map((group) => group.groupId);
  const selectedGroupTotal = selectedGroup
    ? selectedGroup.criteria.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0)
    : 0;
  const selectedGroupMaxTotal = selectedGroup
    ? selectedGroup.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0)
    : 0;
  const rosterGroup = rosterGroupId
    ? displayGroups.find((group) => group.groupId === rosterGroupId) ?? null
    : null;

  function updateUrl(groupId: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('groupId', groupId);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  async function renameGroup(groupId: string, currentName: string) {
    const trimmedName = currentName.trim();
    if (!trimmedName) {
      return '';
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/groups/${groupId}/rename`, {
        body: JSON.stringify({
          sessionId,
          groupId,
          name: trimmedName
        }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'PATCH'
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not rename the group.');
      }

      const renamedGroupName = typeof payload.name === 'string' ? payload.name : trimmedName;
      return renamedGroupName;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Could not rename the group.');
    }
  }

  function startEditingGroup(groupId: string, currentName: string) {
    renameBlurActionRef.current = null;
    setSelectedGroupId(groupId);
    updateUrl(groupId);
    setEditingGroupId(groupId);
    setEditingGroupName(safeTrim(currentName));
  }

  function cancelEditingGroup() {
    renameBlurActionRef.current = null;
    setEditingGroupId(null);
    setEditingGroupName('');
  }

  async function finishEditingGroup(groupId: string, nextName: string) {
    const trimmedName = safeTrim(nextName);
    const currentGroup = groups.find((group) => group.groupId === groupId);
    if (!currentGroup || !trimmedName || trimmedName === safeTrim(currentGroup.groupName)) {
      cancelEditingGroup();
      return;
    }

    try {
      const renamedGroupName = await renameGroup(groupId, trimmedName);
      if (!renamedGroupName) {
        cancelEditingGroup();
        return;
      }
      setGroups((current) =>
        current.map((group) =>
          group.groupId === groupId ? { ...group, groupName: renamedGroupName } : group
        )
      );
      cancelEditingGroup();
    } catch (error) {
      setEditingGroupName(safeTrim(currentGroup?.groupName) || trimmedName);
      renameBlurActionRef.current = null;
      console.error(error);
    }
  }

  async function persistPresentationOrder(nextGroupIds: string[]) {
    const previousGroups = groups;
    setGroups(reorderGroupsByIds(previousGroups, nextGroupIds));
    setPresentationOrderError(null);
    setPresentationOrderSaving(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/order/reorder`, {
        body: JSON.stringify({ orderedGroupIds: nextGroupIds }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST'
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not update presentation order.');
      }

      const orderByGroupId = new Map(
        payload.groups.map((group: { groupId: string; presentationOrder: number }) => [
          group.groupId,
          group.presentationOrder
        ])
      );

      setGroups((current) =>
        reorderGroupsByIds(
          current,
          payload.groups.map((group: { groupId: string }) => group.groupId)
        ).map((group) => ({
          ...group,
          presentationOrder: orderByGroupId.get(group.groupId) ?? group.presentationOrder
        }))
      );
    } catch (error) {
      setGroups(previousGroups);
      setPresentationOrderError(
        error instanceof Error ? error.message : 'Could not update presentation order.'
      );
    } finally {
      setPresentationOrderSaving(false);
      setDraggedTabGroupId(null);
      setDropTargetTabGroupId(null);
    }
  }

  function moveGroupBefore(draggedGroupId: string, targetGroupId: string | null) {
    if (draggedGroupId === targetGroupId) {
      return;
    }

    const nextGroupIds = tabGroupIds.filter((groupId) => groupId !== draggedGroupId);
    if (!targetGroupId) {
      nextGroupIds.push(draggedGroupId);
    } else {
      const targetIndex = nextGroupIds.indexOf(targetGroupId);
      if (targetIndex === -1) {
        nextGroupIds.push(draggedGroupId);
      } else {
        nextGroupIds.splice(targetIndex, 0, draggedGroupId);
      }
    }

    void persistPresentationOrder(nextGroupIds);
  }

  function setGroupState(groupId: string, updater: (group: GroupDraft) => GroupDraft) {
    let nextSnapshot: GroupDraft | null = null;
    setGroups((current) =>
      current.map((group) => {
        if (group.groupId !== groupId) {
          return group;
        }
        nextSnapshot = updater(group);
        return nextSnapshot;
      })
    );
    return nextSnapshot;
  }

  async function persistGroup(groupId: string, snapshot: GroupDraft, requestVersion: number) {
    setSaveStates((current) => ({ ...current, [groupId]: { kind: 'saving' } }));

    try {
      const response = await fetch(`/api/sessions/${sessionId}/evaluation/groups/${groupId}`, {
        body: JSON.stringify({
          finalFeedback: buildFeedbackString(snapshot.finalFeedbackSections, sessionLanguage),
          presentationComments: snapshot.presentationComments,
          qaComments: snapshot.qaComments,
          scores: snapshot.criteria.flatMap((criterion) =>
            criterion.score === null
              ? []
              : [
                  {
                    criterionId: criterion.id,
                    feedback: criterion.feedback ?? null,
                    score: criterion.score
                  }
                ]
          )
        }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'PATCH'
      });

      const payload = await response.json().catch(() => ({}));
      const latestVersion = requestVersions.current[groupId] ?? 0;

      if (!response.ok) {
        if (latestVersion === requestVersion) {
          setSaveStates((current) => ({
            ...current,
            [groupId]: {
              kind: 'failed',
              message: payload.error ?? 'Could not save changes.'
            }
          }));
        }
        return;
      }

      if (latestVersion !== requestVersion) {
        return;
      }

      if (payload.group) {
        setGroups((current) =>
          current.map((group) => {
            if (group.groupId !== groupId) {
              return group;
            }

            if (activeFeedbackGroupIdRef.current === groupId) {
              return {
                ...payload.group,
                finalFeedback: group.finalFeedback,
                finalFeedbackSections: group.finalFeedbackSections
              };
            }

            return payload.group;
          })
        );
      }

      setSaveStates((current) => ({
        ...current,
        [groupId]: {
          at: new Date().toISOString(),
          kind: 'saved'
        }
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save changes.';
      if ((requestVersions.current[groupId] ?? 0) === requestVersion) {
        setSaveStates((current) => ({
          ...current,
          [groupId]: {
            kind: 'failed',
            message
          }
        }));
      }
    }
  }

  function queueSave(groupId: string, snapshot: GroupDraft) {
    const nextVersion = (requestVersions.current[groupId] ?? 0) + 1;
    requestVersions.current[groupId] = nextVersion;

    if (saveTimers.current[groupId]) {
      clearTimeout(saveTimers.current[groupId]);
    }

    setSaveStates((current) => ({ ...current, [groupId]: { kind: 'saving' } }));

    saveTimers.current[groupId] = setTimeout(() => {
      void persistGroup(groupId, snapshot, nextVersion);
    }, 650);
  }

  async function saveGroupNow(groupId: string, snapshot: GroupDraft) {
    const nextVersion = (requestVersions.current[groupId] ?? 0) + 1;
    requestVersions.current[groupId] = nextVersion;

    if (saveTimers.current[groupId]) {
      clearTimeout(saveTimers.current[groupId]);
      saveTimers.current[groupId] = undefined;
    }

    await persistGroup(groupId, snapshot, nextVersion);
  }

  function updateGroup(groupId: string, updater: (group: GroupDraft) => GroupDraft) {
    const nextSnapshot = setGroupState(groupId, updater);
    if (nextSnapshot) {
      queueSave(groupId, nextSnapshot);
    }
  }

  function setGroupPanelState(groupId: string, updater: (state: PanelState) => PanelState) {
    setPanelStates((current) => ({
      ...current,
      [groupId]: updater(
        current[groupId] ?? {
          challengeOpen: true,
          gradingOpen: false,
          notesOpen: true
        }
      )
    }));
  }

  function openGradingForGroup(groupId: string) {
    setGroupPanelState(groupId, () => ({
      challengeOpen: true,
      gradingOpen: true,
      notesOpen: false
    }));
  }

  async function regenerateChallengeQuestions(groupId: string) {
    setChallengeQuestionsSkipped((current) => {
      if (!current[groupId]) {
        return current;
      }

      const next = { ...current };
      delete next[groupId];
      return next;
    });

    setGroups((current) =>
      current.map((group) =>
        group.groupId === groupId
          ? {
              ...group,
              aiGeneratedAt: null,
              aiLastError: null,
              aiRecommendedQuestions: [],
              aiStatus: 'generating'
            }
          : group
      )
    );

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/evaluation/groups/${groupId}/ai`,
        {
          body: JSON.stringify({ mode: 'questions' }),
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST'
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not regenerate challenge questions.');
      }

      if (payload.group) {
        setGroups((current) =>
          current.map((group) => (group.groupId === groupId ? payload.group : group))
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not regenerate challenge questions.';
      setGroups((current) =>
        current.map((group) =>
          group.groupId === groupId
            ? {
                ...group,
                aiGeneratedAt: null,
                aiLastError: message,
                aiRecommendedQuestions: [],
                aiStatus: 'failed'
              }
            : group
        )
      );
    }
  }

  async function generateGroupFeedback(groupId: string) {
    openGradingForGroup(groupId);
    setGroups((current) =>
      current.map((group) =>
        group.groupId === groupId
          ? {
              ...group,
              aiLastError: null,
              aiStatus: 'generating'
            }
            : group
      )
    );

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/evaluation/groups/${groupId}/ai`,
        {
          body: JSON.stringify({ mode: 'grading' }),
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST'
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not generate AI recommendations.');
      }

      if (payload.group) {
        setGroups((current) =>
          current.map((group) => (group.groupId === groupId ? payload.group : group))
        );
      }

      setSpellcheckReady((current) => ({ ...current, [groupId]: false }));
      setSaveStates((current) => ({
        ...current,
        [groupId]: { kind: 'saved', at: new Date().toISOString() }
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not generate AI recommendations.';
      setGroups((current) =>
        current.map((group) =>
          group.groupId === groupId
            ? {
                ...group,
                aiLastError: message,
                aiStatus: 'failed'
              }
            : group
        )
      );
    }
  }

  async function runBatchAi(mode: 'grading' | 'questions') {
    if (mode === 'questions') {
      setChallengeQuestionsBatchState({ kind: 'running', message: '' });
    } else {
      setGradingBatchState({ kind: 'running', message: '' });
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/evaluation/ai`, {
        body: JSON.stringify({ mode }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST'
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not run batch AI.');
      }

      if (Array.isArray(payload.groups)) {
        setGroups((current) =>
          current.map((group) => {
            const nextGroup = payload.groups.find(
              (entry: GroupDraft) => entry.groupId === group.groupId
            );
            return nextGroup ? nextGroup : group;
          })
        );

        const nextPanelStates: Record<string, PanelState> = {};
        for (const group of payload.groups as GroupDraft[]) {
          const hasAiFeedback =
            Boolean(group.aiRecommendedFeedback) || group.aiRecommendedCriteria.length > 0 || group.finalFeedback.trim().length > 0;
          nextPanelStates[group.groupId] = {
            challengeOpen: true,
            gradingOpen: hasAiFeedback,
            notesOpen: !hasAiFeedback
          };
        }
        setPanelStates((current) => ({ ...current, ...nextPanelStates }));

        if (mode === 'grading') {
          setSpellcheckReady((current) => {
            const nextState = { ...current };
            for (const group of payload.groups as GroupDraft[]) {
              if (group.aiRecommendedFeedback) {
                nextState[group.groupId] = false;
              }
            }
            return nextState;
          });
        }
      }

      const skipped = Array.isArray(payload.skipped) ? payload.skipped : [];
      if (mode === 'questions') {
        const nextSkipped = Object.fromEntries(
          skipped.map((entry: { groupId: string; reason: string }) => [entry.groupId, entry.reason])
        );
        setChallengeQuestionsSkipped(nextSkipped);
        setChallengeQuestionsBatchState({
          kind: 'done',
          message:
            skipped.length > 0
              ? `Generated questions for eligible groups. ${skipped.length} group(s) skipped.`
              : 'Generated questions for all eligible groups.'
        });
      } else {
        setGradingBatchState({
          kind: 'done',
          message:
            skipped.length > 0
              ? `Generated feedback and grades for eligible groups. ${skipped.length} group(s) skipped.`
              : 'Generated feedback and grades for all eligible groups.'
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not run batch AI.';
      if (mode === 'questions') {
        setChallengeQuestionsBatchState({ kind: 'failed', message });
      } else {
        setGradingBatchState({ kind: 'failed', message });
      }
    }
  }

  async function runSpellCheck(groupId: string) {
    const group = groups.find((entry) => entry.groupId === groupId);
    if (!group) {
      return;
    }

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/evaluation/groups/${groupId}/spellcheck`,
        {
          body: JSON.stringify({
            sections: group.finalFeedbackSections
          }),
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST'
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveStates((current) => ({
          ...current,
          [groupId]: {
            kind: 'failed',
            message: payload.error ?? 'Could not run spell-check.'
          }
        }));
        return;
      }

      updateGroup(groupId, (current) => ({
        ...current,
        finalFeedback: payload.combined ?? current.finalFeedback,
        finalFeedbackSections: payload.sections ?? current.finalFeedbackSections
      }));
      setSpellcheckReady((current) => ({ ...current, [groupId]: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not run spell-check.';
      setSaveStates((current) => ({
        ...current,
        [groupId]: {
          kind: 'failed',
          message
        }
      }));
    }
  }

  async function finalizeGroup(groupId: string) {
    const group = groups.find((entry) => entry.groupId === groupId);
    if (!group) {
      return;
    }

    try {
      await saveGroupNow(groupId, group);

      const response = await fetch(`/api/sessions/${sessionId}/evaluation/groups/${groupId}`, {
        body: JSON.stringify({ action: 'finalize' }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST'
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveStates((current) => ({
          ...current,
          [groupId]: {
            kind: 'failed',
            message: payload.error ?? 'Could not finalize this group.'
          }
        }));
        return;
      }

      if (payload.group) {
        setGroups((current) =>
          current.map((entry) => (entry.groupId === groupId ? payload.group : entry))
        );
      }

      setSaveStates((current) => ({
        ...current,
        [groupId]: { kind: 'saved', at: new Date().toISOString() }
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not finalize this group.';
      setSaveStates((current) => ({
        ...current,
        [groupId]: {
          kind: 'failed',
          message
        }
      }));
    }
  }

  async function resetGroupScores(groupId: string) {
    const confirmed = window.confirm(
      'Reset all criterion scores for this group? Teacher notes, Q&A notes, AI challenge questions, and final feedback will be kept.'
    );

    if (!confirmed) {
      return;
    }

    const snapshot = setGroupState(groupId, (current) => ({
      ...current,
      criteria: current.criteria.map((criterion) => ({
        ...criterion,
        score: null
      }))
    }));

    if (!snapshot) {
      return;
    }

    await saveGroupNow(groupId, snapshot);
  }

  return (
    <div className="grid gap-4">
      <CollapsiblePanel
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={challengeQuestionsBatchState.kind === 'running'}
              onClick={() => void runBatchAi('questions')}
              type="button"
            >
              {challengeQuestionsBatchState.kind === 'running'
                ? 'Generating all questions...'
                : 'Generate all questions'}
            </button>
            <button
              className="ui-button ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={gradingBatchState.kind === 'running'}
              onClick={() => void runBatchAi('grading')}
              type="button"
            >
              {gradingBatchState.kind === 'running'
                ? 'Generating all groups feedback...'
                : 'Generate all groups feedback'}
            </button>
          </div>
        }
        className="mb-1"
        description="Keep the assignment brief and AI batch actions in one place for the whole workspace."
        title="Activity instructions"
        titleClassName="text-2xl font-semibold"
      >
        <section className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Assignment brief</h3>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              This brief is used by the AI question and feedback workflow.
            </p>
          </div>
          <form action={saveSessionInstructionsAction} className="grid gap-3">
            <input name="sessionId" type="hidden" value={sessionId} />
            <label className="grid gap-2 text-sm font-medium">
              Assignment brief
              <textarea
                className="ui-textarea min-h-[140px]"
                defaultValue={sessionInstructions ?? ''}
                name="instructions"
                placeholder="Describe the activity, expectations, and anything the AI should consider."
              />
            </label>
            <div className="flex justify-end">
              <button
                className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
              >
                Save brief
              </button>
            </div>
          </form>
          {challengeQuestionsBatchState.message ? (
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              {challengeQuestionsBatchState.message}
            </p>
          ) : null}
          {gradingBatchState.message ? (
            <p className="text-sm text-[color:var(--app-fg-muted)]">{gradingBatchState.message}</p>
          ) : null}
        </section>
      </CollapsiblePanel>

      {selectedGroup ? (
        <>
          <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] shadow-sm">
            <div className="border-b border-[color:var(--app-border)] px-3 pt-3">
              <div
                className="flex items-end gap-3"
                onDragOver={(event) => {
                  if (draggedTabGroupId) {
                    event.preventDefault();
                  }
                }}
                onDrop={(event) => {
                  if (!draggedTabGroupId) {
                    return;
                  }

                  event.preventDefault();
                  moveGroupBefore(draggedTabGroupId, null);
                }}
              >
                <div className="flex min-w-0 flex-1 flex-nowrap items-end gap-1 overflow-x-auto">
                  {displayGroups.map((group) => {
                    const isActive = group.groupId === selectedGroupId;
                    const isDragged = draggedTabGroupId === group.groupId;
                    const isDropTarget = dropTargetTabGroupId === group.groupId;
                    const isEditing = editingGroupId === group.groupId;

                    return (
                      <div key={group.groupId} className="group relative shrink-0">
                        <button
                          draggable={!presentationOrderSaving}
                          className={`relative -mb-px flex items-center gap-2 rounded-t-[1.1rem] border border-b-0 px-4 py-3 pr-9 text-sm font-medium transition ${
                            isActive
                              ? 'z-20 border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-[color:var(--app-fg)] shadow-[0_-1px_0_var(--app-border)]'
                              : 'border-[color:var(--app-border)] border-b-[color:var(--app-surface)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-fg-muted)] hover:bg-[color:var(--app-surface-soft)]'
                          } ${isDragged ? 'opacity-40' : ''} ${
                            isDropTarget ? 'ring-2 ring-[color:var(--app-accent)]/25' : ''
                          } ${presentationOrderSaving ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing'} ${
                            isEditing ? 'pointer-events-none opacity-0' : ''
                          }`}
                          onClick={() => {
                            setSelectedGroupId(group.groupId);
                            updateUrl(group.groupId);
                          }}
                          onDragStart={(event) => {
                            if (presentationOrderSaving) {
                              event.preventDefault();
                              return;
                            }

                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', group.groupId);
                            setDraggedTabGroupId(group.groupId);
                          }}
                          onDragEnd={() => {
                            setDraggedTabGroupId(null);
                            setDropTargetTabGroupId(null);
                          }}
                          onDragOver={(event) => {
                            if (!draggedTabGroupId || draggedTabGroupId === group.groupId) {
                              return;
                            }

                            event.preventDefault();
                            setDropTargetTabGroupId(group.groupId);
                          }}
                          onDrop={(event) => {
                            if (!draggedTabGroupId) {
                              return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            moveGroupBefore(draggedTabGroupId, group.groupId);
                          }}
                          type="button"
                        >
                          <span className="truncate">{group.groupName}</span>
                        </button>
                        {isEditing ? (
                          <input
                            ref={editingGroupNameInputRef}
                            aria-label={`Rename ${group.groupName}`}
                            className={`absolute inset-0 z-30 w-full rounded-t-[1.1rem] border border-[color:var(--app-border)] px-4 py-3 pr-9 text-sm font-medium outline-none ${
                              isActive
                                ? 'bg-[color:var(--app-surface)] text-[color:var(--app-fg)] shadow-[0_-1px_0_var(--app-border)]'
                                : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-fg)]'
                            }`}
                            autoComplete="off"
                            onBlur={(event) => {
                              if (renameBlurActionRef.current === 'cancel') {
                                cancelEditingGroup();
                                return;
                              }

                              renameBlurActionRef.current = null;
                              void finishEditingGroup(group.groupId, event.currentTarget.value);
                            }}
                            onChange={(event) => setEditingGroupName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                renameBlurActionRef.current = 'cancel';
                                event.currentTarget.blur();
                                return;
                              }

                              if (event.key === 'Enter') {
                                event.preventDefault();
                                renameBlurActionRef.current = 'save';
                                event.currentTarget.blur();
                              }
                            }}
                            spellCheck={false}
                            type="text"
                            value={editingGroupName}
                          />
                        ) : null}
                        <button
                          aria-label={`Rename ${group.groupName}`}
                          className="absolute right-2 top-1/2 z-30 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--app-fg-muted)] opacity-70 transition hover:text-[color:var(--app-fg)] hover:opacity-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditingGroup(group.groupId, group.groupName);
                          }}
                          title="Rename group"
                          type="button"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="pb-3">
                  <RandomizeOrderButton
                    groups={tabGroupsForRandomization}
                    onRandomized={(randomizedGroups) => {
                      const orderByGroupId = new Map(
                        randomizedGroups.map((group) => [group.groupId, group.presentationOrder])
                      );

                      setGroups((current) =>
                        reorderGroupsByIds(
                          current,
                          randomizedGroups.map((group) => group.groupId)
                        ).map((group) => ({
                          ...group,
                          presentationOrder:
                            orderByGroupId.get(group.groupId) ?? group.presentationOrder
                        }))
                      );
                    }}
                    sessionId={sessionId}
                  />
                </div>
              </div>
            </div>

            {presentationOrderError ? (
              <div className="px-4 pt-3 text-sm text-[color:var(--app-danger)]">
                {presentationOrderError}
              </div>
            ) : null}

            <div className="bg-[color:var(--app-surface)] p-4">
              <CollapsiblePanel
                className="border-0 bg-transparent p-0 shadow-none"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="ui-button ui-button-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => setRosterGroupId(selectedGroup.groupId)}
                      type="button"
                    >
                      Roster
                    </button>
                  </div>
                }
                description={
                  <>
                    <p>
                      {selectedGroup.presentationOrder
                        ? `Presentation order ${selectedGroup.presentationOrder}.`
                        : 'Presentation order not locked yet.'}
                    </p>
                    <p>
                      {selectedGroup.submissionTitle
                        ? `Submission: ${selectedGroup.submissionTitle}.`
                        : 'No submission uploaded yet.'}
                    </p>
                  </>
                }
                title="Group details"
                titleLabel="Group details"
                titleClassName="text-2xl font-semibold"
              >
                <div className="grid gap-4">
                  <CollapsiblePanel
                    actions={
                      <div className="text-right text-sm text-[color:var(--app-fg-muted)]">
                        <div>{scoreStateLabel(saveStates[selectedGroup.groupId] ?? { kind: 'idle' })}</div>
                        <div>
                          Finalized:{' '}
                          {selectedGroup.submittedAt ? getTimestampLabel(selectedGroup.submittedAt) : 'No'}
                        </div>
                      </div>
                    }
                    contentClassName="gap-4"
                    open={notesOpen}
                    onOpenChange={(open) =>
                      setGroupPanelState(selectedGroup.groupId, (current) => ({
                        ...current,
                        notesOpen: open
                      }))
                    }
                    title="Scoring and feedback"
                    description="with the power of ExpertLab AI"
                    titleClassName="text-lg font-semibold"
                  >
                    <label className="grid gap-2 text-sm font-medium">
                      Presentation comments
                      <textarea
                        className="ui-textarea min-h-[140px]"
                        onChange={(event) =>
                          updateGroup(selectedGroup.groupId, (current) => ({
                            ...current,
                            presentationComments: event.target.value
                          }))
                        }
                        placeholder="Write the live presentation notes here."
                        value={selectedGroup.presentationComments}
                      />
                    </label>

                    <CollapsiblePanel
                      actions={
                        selectedGroupHasChallengeQuestions ||
                        selectedGroup.aiStatus === 'generating' ||
                        selectedGroupHasUploadedWork ? (
                          <button
                            className="ui-button ui-button-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={selectedGroup.aiStatus === 'generating'}
                            onClick={() => void regenerateChallengeQuestions(selectedGroup.groupId)}
                            type="button"
                          >
                            {selectedGroup.aiStatus === 'generating'
                              ? 'Generating...'
                              : selectedGroupHasChallengeQuestions
                                ? 'Regenerate questions'
                                : 'Generate questions'}
                          </button>
                        ) : null
                      }
                      contentClassName="gap-3"
                      open={challengeOpen}
                      onOpenChange={(open) =>
                        setGroupPanelState(selectedGroup.groupId, (current) => ({
                          ...current,
                          challengeOpen: open
                        }))
                      }
                      title="Challenge questions"
                      titleClassName="text-base font-semibold"
                    >
                      {selectedGroupHasChallengeQuestions ? (
                        <ul className="grid gap-2 text-sm text-[color:var(--app-fg-muted)]">
                          {selectedGroup.aiRecommendedQuestions.map((question, index) => (
                            <li
                              key={`${question}-${index}`}
                              className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2"
                            >
                              {question}
                            </li>
                          ))}
                        </ul>
                      ) : selectedGroup.aiStatus === 'generating' ? (
                        <div className="rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-fg-muted)]">
                          Generating new challenge questions...
                        </div>
                      ) : !selectedGroupHasUploadedWork ? (
                        <div className="grid gap-3 rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 text-sm text-[color:var(--app-fg-muted)]">
                          <p>Please upload the group&apos;s work to enable question recommendation.</p>
                          <GroupSubmissionDropzone
                            fileName={selectedGroup.submissionTitle}
                            groupId={selectedGroup.groupId}
                            groupName="this group"
                            sessionId={sessionId}
                            submittedAt={selectedGroup.submittedAt}
                          />
                        </div>
                      ) : selectedGroup.aiStatus === 'failed' ? (
                        <div className="rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-danger)]">
                          Could not generate challenge questions.
                          {selectedGroup.aiLastError ? ` ${selectedGroup.aiLastError}` : ''}
                        </div>
                      ) : (
                        <div className="grid gap-3 rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 text-sm text-[color:var(--app-fg-muted)]">
                          <p>Generate questions from the uploaded work to prepare the oral defense.</p>
                        </div>
                      )}
                    </CollapsiblePanel>

                    <label className="grid gap-2 text-sm font-medium">
                      Q&amp;A comments
                      <textarea
                        className="ui-textarea min-h-[120px]"
                        onChange={(event) =>
                          updateGroup(selectedGroup.groupId, (current) => ({
                            ...current,
                            qaComments: event.target.value
                          }))
                        }
                        placeholder="Optional notes for the questions and answers phase."
                        value={selectedGroup.qaComments}
                      />
                    </label>

                    <div className="flex justify-end">
                      <span
                        className="inline-flex"
                        title={
                          selectedGroupHasFeedbackInputs
                            ? 'Send the notes or uploaded work to AI for structured feedback and conservative grade suggestions.'
                            : 'Add comments or upload work before generating AI feedback and grades.'
                        }
                      >
                        <button
                          className="ui-button ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!selectedGroupHasFeedbackInputs || selectedGroup.aiStatus === 'generating'}
                          onClick={() => void generateGroupFeedback(selectedGroup.groupId)}
                          type="button"
                        >
                          {selectedGroup.aiStatus === 'generating'
                            ? 'Generating feedback...'
                            : 'Generate AI feedback & grades'}
                        </button>
                      </span>
                    </div>
                  </CollapsiblePanel>

                  <CollapsiblePanel
                    contentClassName="gap-4"
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="ui-button ui-button-danger disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void resetGroupScores(selectedGroup.groupId)}
                          type="button"
                        >
                          Reset scores
                        </button>
                        <button
                          className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!selectedGroup.readyForFinalization}
                          onClick={() => void finalizeGroup(selectedGroup.groupId)}
                          type="button"
                        >
                          Mark ready for export
                        </button>
                      </div>
                    }
                    open={gradingOpen}
                    onOpenChange={(open) =>
                      setGroupPanelState(selectedGroup.groupId, (current) => ({
                        ...current,
                        gradingOpen: open
                      }))
                    }
                    title="Final grading"
                    titleClassName="text-lg font-semibold"
                  >
                    <div className="grid gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">AI status</span>
                        <span className="ui-chip">{selectedGroup.aiStatus}</span>
                      </div>
                      {selectedGroup.aiLastError ? (
                        <p className="text-[color:var(--app-danger)]">{selectedGroup.aiLastError}</p>
                      ) : null}
                      {selectedGroup.aiGeneratedAt ? (
                        <p className="text-[color:var(--app-fg-muted)]">
                          Generated {getTimestampLabel(selectedGroup.aiGeneratedAt)}
                        </p>
                      ) : null}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
                      <table className="w-full border-collapse text-sm">
                        <thead className="bg-[color:var(--app-surface-muted)] text-left">
                          <tr>
                            <th className="px-3 py-3 font-medium">Criterion</th>
                            <th className="px-3 py-3 font-medium">Final score</th>
                            <th className="px-3 py-3 font-medium">Max</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedGroup.criteria.map((criterion) => (
                            <tr key={criterion.id} className="border-t border-[color:var(--app-border)]">
                              <td className="px-3 py-3 align-top">
                                <div className="font-medium">{criterion.label}</div>
                                {criterion.description ? (
                                  <div className="mt-1 text-xs text-[color:var(--app-fg-muted)]">
                                    {criterion.description}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <input
                                  className="ui-input w-24"
                                  max={criterion.maxScore}
                                  min={0}
                                  step={0.5}
                                  onChange={(event) => {
                                    const parsed =
                                      event.target.value === ''
                                        ? null
                                        : Number.parseFloat(event.target.value);
                                    const value = parsed === null || Number.isNaN(parsed) ? null : parsed;
                                    updateGroup(selectedGroup.groupId, (current) => ({
                                      ...current,
                                      criteria: current.criteria.map((entry) =>
                                        entry.id === criterion.id ? { ...entry, score: value } : entry
                                      )
                                    }));
                                  }}
                                  type="number"
                                  value={criterion.score ?? ''}
                                />
                              </td>
                              <td className="px-3 py-3 align-top">{criterion.maxScore}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">Final total</span>
                        <span className="ui-chip">
                          {formatScoreTotal(selectedGroupTotal)}/{formatScoreTotal(selectedGroupMaxTotal)}
                        </span>
                      </div>
                      <p className="text-[color:var(--app-fg-muted)]">
                        The total is calculated from the teacher-controlled scores above.
                      </p>
                    </div>

                    <section className="grid gap-4 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="ui-section-title">Final feedback</p>
                          <h4 className="text-base font-semibold">Editable summary</h4>
                        </div>
                        {selectedGroupCanSpellCheck ? (
                          <button
                            className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => void runSpellCheck(selectedGroup.groupId)}
                            type="button"
                          >
                            Spell-check feedback
                          </button>
                        ) : null}
                      </div>

                      <div
                        className="grid gap-4"
                        onBlurCapture={(event) => {
                          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            return;
                          }

                          activeFeedbackGroupIdRef.current = null;
                        }}
                        onFocusCapture={() => {
                          activeFeedbackGroupIdRef.current = selectedGroup.groupId;
                        }}
                      >
                        {[
                          ['strengths', 'Strengths'],
                          ['development', 'Points for development'],
                          ['general', 'General feedback']
                        ].map(([key, label]) => (
                          <label key={key} className="grid gap-2 text-sm font-medium">
                            {label}
                            <textarea
                              className="ui-textarea min-h-[120px]"
                              onChange={(event) => {
                                setSpellcheckReady((current) => ({
                                  ...current,
                                  [selectedGroup.groupId]: true
                                }));
                                updateGroup(selectedGroup.groupId, (current) => {
                                  const nextSections = {
                                    ...current.finalFeedbackSections,
                                    [key]: event.target.value
                                  } as EvaluationAiFeedbackSections;
                                  return {
                                    ...current,
                                    finalFeedback: buildFeedbackString(nextSections, sessionLanguage),
                                    finalFeedbackSections: nextSections
                                  };
                                });
                              }}
                              value={selectedGroup.finalFeedbackSections[key as keyof EvaluationAiFeedbackSections]}
                            />
                          </label>
                        ))}
                      </div>
                    </section>
                  </CollapsiblePanel>
                </div>
              </CollapsiblePanel>
            </div>
          </section>
        </>
      ) : (
        <section className="ui-panel p-6">
          <h2 className="text-lg font-semibold">No groups available</h2>
          <p className="mt-2 text-sm text-[color:var(--app-fg-muted)]">
            Create or assign groups before using the evaluation workspace.
          </p>
        </section>
      )}

      <EvaluationRosterDialog
        groups={displayGroups}
        groupId={rosterGroup?.groupId ?? ''}
        groupTotal={selectedGroup ? selectedGroupTotal : null}
        onClose={() => setRosterGroupId(null)}
        open={Boolean(rosterGroup)}
        sessionId={sessionId}
      />
    </div>
  );
}
