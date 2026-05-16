'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { saveSessionInstructionsAction } from '@/app/sessions/actions';
import { useInteractionFeedback } from '@/components/app-interaction-feedback';
import { CollapsiblePanel } from '@/components/collapsible-panel';
import { EvaluationRosterDialog } from '@/components/evaluation-roster-dialog';
import { GroupSubmissionDropzone } from '@/components/group-submission-dropzone';
import { RandomizeOrderButton } from '@/components/randomize-order-button';
import { useUiLanguage } from '@/components/ui-language-toggle';
import { shouldShowAdminDiagnostics } from '@/lib/admin-diagnostics';
import { formatFeedbackSections } from '@/lib/evaluation/engine';
import { getUiText } from '@/lib/ui-language';
import type { UiLanguage } from '@/lib/ui-language';
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

type SerializableChallengeQuestionsDebug = {
  fallbackReason: string | null;
  parsedQuestionsBeforeValidation: string[] | null;
  model: string | null;
  promptKeyUsed: 'generate_challenge_questions';
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
  verificationStatus: string;
};

type EvaluationWorkspaceClientProps = {
  groups: SerializableGroup[];
  initialGroupId: string;
  sessionId: string;
  sessionLanguage: string;
  sessionInstructions: string | null;
  sessionSubject: string;
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

type ChallengeQuestionSkippedGroup = {
  groupId: string;
  groupName: string;
  reason: string;
};

function buildFeedbackString(sections: EvaluationAiFeedbackSections, language: string) {
  return formatFeedbackSections(sections, language);
}

function getTimestampLabel(value: string | null, language: UiLanguage, mounted: boolean) {
  if (!value) {
    return language === 'fr' ? 'Non enregistré pour le moment' : 'Not saved yet';
  }

  if (!mounted) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function scoreStateLabel(state: SaveState, language: UiLanguage, mounted: boolean) {
  switch (state.kind) {
    case 'failed':
      return language === 'fr' ? `Échec de l’enregistrement : ${state.message}` : `Save failed: ${state.message}`;
    case 'saved': {
      const timestamp = getTimestampLabel(state.at, language, mounted);
      return timestamp
        ? `${language === 'fr' ? 'Enregistré' : 'Saved'} ${timestamp}`
        : language === 'fr'
          ? 'Enregistré'
          : 'Saved';
    }
    case 'saving':
      return language === 'fr' ? 'Enregistrement...' : 'Saving...';
    default:
      return language === 'fr' ? 'En attente' : 'Idle';
  }
}

function AutoSaveIndicatorIcon({
  ariaLabel,
  disabled = false,
  onClick,
  state,
  title
}: {
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
  state: SaveState;
  title: string;
}) {
  const toneClass =
    state.kind === 'failed'
      ? 'text-[color:var(--app-danger)]'
      : state.kind === 'saving'
        ? 'text-[color:var(--app-warning)]'
        : 'text-[color:var(--app-success)]';

  return (
    <button
      aria-label={ariaLabel}
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] ${toneClass} disabled:cursor-not-allowed disabled:opacity-60`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {state.kind === 'failed' ? (
        <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
          <path d="M8 2.25L14 13.25H2L8 2.25Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 5.5V9.25" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
          <circle cx="8" cy="11.5" fill="currentColor" r="0.9" />
        </svg>
      ) : state.kind === 'saving' ? (
        <svg aria-hidden="true" className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 16 16">
          <circle cx="8" cy="8" opacity="0.25" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
        </svg>
      ) : (
        <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8.1L7.1 10.2L11.1 6.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
        </svg>
      )}
    </button>
  );
}

function formatScoreTotal(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function safeTrim(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

const ASSIGNMENT_BRIEF_AUTOSAVE_DELAY_MS = 3000;
const GROUP_TEXT_AUTOSAVE_DELAY_MS = 3000;
const GROUP_DEFAULT_AUTOSAVE_DELAY_MS = 650;

function normalizeAssignmentBrief(value: string | null | undefined) {
  return safeTrim(value);
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

function getAiStatusLabel(status: 'idle' | 'generating' | 'ready' | 'failed', language: UiLanguage) {
  return {
    failed: language === 'fr' ? 'Échec' : 'Failed',
    generating: language === 'fr' ? 'Génération' : 'Generating',
    idle: language === 'fr' ? 'En attente' : 'Idle',
    ready: language === 'fr' ? 'Prêt' : 'Ready'
  }[status];
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
  sessionLanguage,
  sessionSubject
}: EvaluationWorkspaceClientProps) {
  const router = useRouter();
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).evaluationWorkspace;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { runPending } = useInteractionFeedback();
  const [groups, setGroups] = useState<GroupDraft[]>(() => initialDraftGroups(initialGroups));
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [panelStates, setPanelStates] = useState<Record<string, PanelState>>(() =>
    initialPanelStates(initialGroups)
  );
  const [spellcheckReady, setSpellcheckReady] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialGroups.map((group) => [group.groupId, false]))
  );
  const [uploadNoticeByGroupId, setUploadNoticeByGroupId] = useState<Record<string, string>>({});
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
  const [challengeQuestionsSkippedGroups, setChallengeQuestionsSkippedGroups] = useState<
    ChallengeQuestionSkippedGroup[]
  >([]);
  const [challengeQuestionsDebugByGroupId, setChallengeQuestionsDebugByGroupId] = useState<
    Record<string, SerializableChallengeQuestionsDebug | null>
  >({});
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
  const [assignmentBriefDraft, setAssignmentBriefDraft] = useState(sessionInstructions ?? '');
  const [assignmentBriefSaveState, setAssignmentBriefSaveState] = useState<SaveState>({ kind: 'idle' });
  const [mounted, setMounted] = useState(false);
  const assignmentBriefDraftRef = useRef(sessionInstructions ?? '');
  const assignmentBriefLastSavedRef = useRef(normalizeAssignmentBrief(sessionInstructions ?? ''));
  const assignmentBriefSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assignmentBriefInFlightRef = useRef(false);
  const assignmentBriefPendingSaveRef = useRef(false);
  const assignmentBriefRequestVersionRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  useEffect(() => {
    assignmentBriefDraftRef.current = assignmentBriefDraft;
  }, [assignmentBriefDraft]);

  useEffect(() => {
    const incomingValue = sessionInstructions ?? '';
    const hasLocalDraftChanges =
      normalizeAssignmentBrief(assignmentBriefDraftRef.current) !== assignmentBriefLastSavedRef.current;

    if (assignmentBriefInFlightRef.current || hasLocalDraftChanges) {
      return;
    }

    assignmentBriefLastSavedRef.current = normalizeAssignmentBrief(incomingValue);
    setAssignmentBriefDraft(incomingValue);
    setAssignmentBriefSaveState((current) => (current.kind === 'failed' ? current : { kind: 'idle' }));
  }, [sessionInstructions]);

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
  const selectedGroupHasUploadedWork = Boolean(
    selectedGroup?.submissionId || selectedGroup?.submissionTitle || selectedGroup?.submittedAt
  );
  const challengeQuestionsDescription = selectedGroupHasUploadedWork
    ? t.reviewChallengeQuestions
    : t.pleaseUploadWork;
  const selectedGroupHasFeedbackInputs = Boolean(
    selectedGroup?.presentationComments.trim() || selectedGroup?.submissionContent?.trim()
  );
  const selectedGroupHasChallengeQuestions = Boolean(selectedGroup?.aiRecommendedQuestions.length);
  const selectedGroupChallengeQuestionsDebug =
    process.env.NODE_ENV !== 'production'
      ? challengeQuestionsDebugByGroupId[selectedGroup?.groupId ?? ''] ?? null
      : null;
  const showAdminDiagnostics = shouldShowAdminDiagnostics();
  const selectedGroupCanSpellCheck = Boolean(
    selectedGroup?.aiRecommendedFeedback && spellcheckReady[selectedGroup?.groupId ?? '']
  );
  const selectedGroupUploadNotice = selectedGroup ? uploadNoticeByGroupId[selectedGroup.groupId] : '';
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
  const workspaceTitle = `${safeTrim(sessionSubject) || 'Session'} Groups`;
  const assignmentBriefDirty =
    normalizeAssignmentBrief(assignmentBriefDraft) !== assignmentBriefLastSavedRef.current;
  const groupSaveState: SaveState = selectedGroup
    ? (saveStates[selectedGroup.groupId] ?? ({ kind: 'idle' } as SaveState))
    : ({ kind: 'idle' } as SaveState);
  const assignmentIndicatorTitle =
    assignmentBriefSaveState.kind === 'saved'
      ? `${uiLanguage === 'fr' ? 'Enregistré' : 'Saved'} ${
          getTimestampLabel(assignmentBriefSaveState.at, uiLanguage, mounted) || ''
        }`.trim()
      : assignmentBriefSaveState.kind === 'saving'
        ? (uiLanguage === 'fr' ? 'Enregistrement en cours…' : 'Saving in progress…')
        : assignmentBriefSaveState.kind === 'failed'
          ? assignmentBriefSaveState.message
          : (uiLanguage === 'fr' ? 'Enregistrement automatique' : 'Autosave');
  const groupIndicatorTitle =
    groupSaveState.kind === 'saved'
      ? `${uiLanguage === 'fr' ? 'Enregistré' : 'Saved'} ${
          getTimestampLabel(groupSaveState.at, uiLanguage, mounted) || ''
        }`.trim()
      : groupSaveState.kind === 'saving'
        ? (uiLanguage === 'fr' ? 'Enregistrement en cours…' : 'Saving in progress…')
        : groupSaveState.kind === 'failed'
          ? groupSaveState.message
          : (uiLanguage === 'fr' ? 'Enregistrement automatique' : 'Autosave');

  function updateUrl(groupId: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('groupId', groupId);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  const persistAssignmentBrief = useCallback(async () => {
    const draftToSave = assignmentBriefDraftRef.current;
    const normalizedDraft = normalizeAssignmentBrief(draftToSave);

    if (normalizedDraft === assignmentBriefLastSavedRef.current) {
      return;
    }

    if (assignmentBriefInFlightRef.current) {
      assignmentBriefPendingSaveRef.current = true;
      return;
    }

    assignmentBriefInFlightRef.current = true;
    assignmentBriefPendingSaveRef.current = false;
    const requestVersion = assignmentBriefRequestVersionRef.current + 1;
    assignmentBriefRequestVersionRef.current = requestVersion;
    setAssignmentBriefSaveState({ kind: 'saving' });

    try {
      const formData = new FormData();
      formData.set('sessionId', sessionId);
      formData.set('instructions', draftToSave);
      await saveSessionInstructionsAction(formData);

      if (assignmentBriefRequestVersionRef.current !== requestVersion) {
        return;
      }

      assignmentBriefLastSavedRef.current = normalizedDraft;
      if (normalizeAssignmentBrief(assignmentBriefDraftRef.current) === normalizedDraft) {
        setAssignmentBriefSaveState({ kind: 'saved', at: new Date().toISOString() });
      } else {
        assignmentBriefPendingSaveRef.current = true;
      }
    } catch (error) {
      if (assignmentBriefRequestVersionRef.current !== requestVersion) {
        return;
      }

      setAssignmentBriefSaveState({
        kind: 'failed',
        message: error instanceof Error ? error.message : t.errors.saveChanges
      });
    } finally {
      assignmentBriefInFlightRef.current = false;
      if (assignmentBriefPendingSaveRef.current) {
        assignmentBriefPendingSaveRef.current = false;
        void persistAssignmentBrief();
      }
    }
  }, [sessionId, t.errors.saveChanges]);

  useEffect(() => {
    if (!assignmentBriefDirty) {
      if (assignmentBriefSaveTimerRef.current) {
        clearTimeout(assignmentBriefSaveTimerRef.current);
        assignmentBriefSaveTimerRef.current = null;
      }
      return;
    }

    if (assignmentBriefSaveTimerRef.current) {
      clearTimeout(assignmentBriefSaveTimerRef.current);
    }

    assignmentBriefSaveTimerRef.current = setTimeout(() => {
      void persistAssignmentBrief();
    }, ASSIGNMENT_BRIEF_AUTOSAVE_DELAY_MS);

    return () => {
      if (assignmentBriefSaveTimerRef.current) {
        clearTimeout(assignmentBriefSaveTimerRef.current);
        assignmentBriefSaveTimerRef.current = null;
      }
    };
  }, [assignmentBriefDirty, assignmentBriefDraft, persistAssignmentBrief]);

  async function persistGroupTextNow(groupId: string) {
    const snapshot = groups.find((entry) => entry.groupId === groupId);
    if (!snapshot) {
      return;
    }

    const currentState: SaveState = saveStates[groupId] ?? ({ kind: 'idle' } as SaveState);
    if (currentState.kind === 'saving') {
      return;
    }

    const hasPendingDebounce = Boolean(saveTimers.current[groupId]);
    const canRetryFailedSave = currentState.kind === 'failed';
    if (!hasPendingDebounce && !canRetryFailedSave) {
      return;
    }

    await saveGroupNow(groupId, snapshot);
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
        throw new Error(payload.error ?? t.errors.renameGroup);
      }

      const renamedGroupName = typeof payload.name === 'string' ? payload.name : trimmedName;
      return renamedGroupName;
    } catch (error) {
      throw error instanceof Error ? error : new Error(t.errors.renameGroup);
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
        throw new Error(payload.error ?? t.errors.updatePresentationOrder);
      }

      const nextGroups = Array.isArray(payload.groups)
        ? (payload.groups as Array<{ groupId: string; presentationOrder: number }>)
        : [];
      const orderByGroupId = new Map(
        nextGroups.map((group) => [
          group.groupId,
          group.presentationOrder
        ])
      );

      setGroups((current) =>
        reorderGroupsByIds(
          current,
          nextGroups.map((group) => group.groupId)
        ).map((group) => ({
          ...group,
          presentationOrder: orderByGroupId.get(group.groupId) ?? group.presentationOrder
        }))
      );
    } catch (error) {
      setGroups(previousGroups);
      setPresentationOrderError(
        error instanceof Error ? error.message : t.errors.updatePresentationOrder
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
              message: payload.error ?? t.errors.saveChanges
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
      const message = error instanceof Error ? error.message : t.errors.saveChanges;
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

  function queueSave(
    groupId: string,
    snapshot: GroupDraft,
    delayMs: number = GROUP_DEFAULT_AUTOSAVE_DELAY_MS
  ) {
    const nextVersion = (requestVersions.current[groupId] ?? 0) + 1;
    requestVersions.current[groupId] = nextVersion;

    if (saveTimers.current[groupId]) {
      clearTimeout(saveTimers.current[groupId]);
    }

    setSaveStates((current) => ({ ...current, [groupId]: { kind: 'saving' } }));

    saveTimers.current[groupId] = setTimeout(() => {
      void persistGroup(groupId, snapshot, nextVersion);
    }, delayMs);
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

  function updateGroup(
    groupId: string,
    updater: (group: GroupDraft) => GroupDraft,
    delayMs: number = GROUP_DEFAULT_AUTOSAVE_DELAY_MS
  ) {
    const nextSnapshot = setGroupState(groupId, updater);
    if (nextSnapshot) {
      queueSave(groupId, nextSnapshot, delayMs);
    }
  }

  function updateGroupText(groupId: string, updater: (group: GroupDraft) => GroupDraft) {
    updateGroup(groupId, updater, GROUP_TEXT_AUTOSAVE_DELAY_MS);
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
    setChallengeQuestionsDebugByGroupId((current) => ({
      ...current,
      [groupId]: null
    }));

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
      await runPending('Generating challenge questions...', async () => {
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
          throw new Error(payload.error ?? t.errors.regenerateChallengeQuestions);
        }

        if (process.env.NODE_ENV !== 'production') {
          setChallengeQuestionsDebugByGroupId((current) => ({
            ...current,
            [groupId]: payload?.ai?.challengeQuestions?.debug ?? null
          }));
        }

        if (payload.group) {
          setGroups((current) =>
            current.map((group) => (group.groupId === groupId ? payload.group : group))
          );
        }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.errors.regenerateChallengeQuestions;
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
      await runPending('Generating AI feedback...', async () => {
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
          throw new Error(payload.error ?? t.errors.generateAiRecommendations);
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
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.errors.generateAiRecommendations;
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
      setChallengeQuestionsSkippedGroups([]);
    } else {
      setGradingBatchState({ kind: 'running', message: '' });
    }

    try {
      await runPending(mode === 'questions' ? 'Generating all questions...' : 'Generating all feedback...', async () => {
        const response = await fetch(`/api/sessions/${sessionId}/evaluation/ai`, {
          body: JSON.stringify({ mode }),
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST'
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? t.errors.runBatchAi);
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
          const skippedGroups = skipped as ChallengeQuestionSkippedGroup[];
          const nextSkipped = Object.fromEntries(
            skippedGroups.map((entry) => [entry.groupId, entry.reason])
          );
          setChallengeQuestionsSkipped(nextSkipped);
          setChallengeQuestionsSkippedGroups(skippedGroups);
          setChallengeQuestionsBatchState({
            kind: 'done',
            message:
              skipped.length > 0
                ? t.batchQuestionsDoneWithSkipped.replace('{count}', String(skipped.length))
                : t.batchQuestionsDoneAll
          });
        } else {
          setGradingBatchState({
            kind: 'done',
            message:
              skipped.length > 0
                ? t.batchFeedbackDoneWithSkipped.replace('{count}', String(skipped.length))
                : t.batchFeedbackDoneAll
          });
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.errors.runBatchAi;
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
            message: payload.error ?? t.errors.runSpellCheck
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
      const message = error instanceof Error ? error.message : t.errors.runSpellCheck;
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
            message: payload.error ?? t.errors.finalizeGroup
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
      const message = error instanceof Error ? error.message : t.errors.finalizeGroup;
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
      t.resetCriterionScoresConfirm
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
              className="ui-button ui-button-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={challengeQuestionsBatchState.kind === 'running'}
              onClick={() => void runBatchAi('questions')}
              type="button"
            >
              {challengeQuestionsBatchState.kind === 'running'
                ? t.generatingAllQuestions
                : t.generateAllQuestions}
            </button>
            <button
              className="ui-button ui-button-primary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={gradingBatchState.kind === 'running'}
              onClick={() => void runBatchAi('grading')}
              type="button"
            >
              {gradingBatchState.kind === 'running'
                ? t.generatingAllFeedback
                : t.generateAllFeedback}
            </button>
          </div>
        }
        className="mb-1"
        title={workspaceTitle}
        titleClassName="text-2xl font-semibold"
      >
        <section className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            {t.briefUsedByAi}
          </p>
          <div className="grid gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>{t.assignmentBrief}</span>
              <AutoSaveIndicatorIcon
                ariaLabel={uiLanguage === 'fr' ? 'Forcer l’enregistrement de la consigne' : 'Force-save assignment brief'}
                disabled={assignmentBriefSaveState.kind === 'saving'}
                onClick={() => {
                  void persistAssignmentBrief();
                }}
                state={assignmentBriefSaveState}
                title={assignmentIndicatorTitle}
              />
            </div>
            <textarea
              aria-label={t.assignmentBrief}
              className="ui-textarea min-h-[140px]"
              onChange={(event) => {
                setAssignmentBriefDraft(event.target.value);
                setAssignmentBriefSaveState((current) =>
                  current.kind === 'saved' ? { kind: 'idle' } : current
                );
              }}
              placeholder={t.describeActivity}
              value={assignmentBriefDraft}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-[color:var(--app-fg-muted)]">
                {assignmentBriefSaveState.kind === 'saving'
                  ? t.saving
                  : assignmentBriefSaveState.kind === 'saved'
                    ? `${t.saved} ${getTimestampLabel(assignmentBriefSaveState.at, uiLanguage, mounted)}`.trim()
                    : assignmentBriefSaveState.kind === 'failed'
                      ? assignmentBriefSaveState.message
                      : ''}
              </div>
              <button
                className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!assignmentBriefDirty || assignmentBriefSaveState.kind === 'saving'}
                onClick={() => {
                  void persistAssignmentBrief();
                }}
                type="button"
              >
                {assignmentBriefSaveState.kind === 'saving' ? t.saving : t.saveBrief}
              </button>
            </div>
          </div>
          {challengeQuestionsBatchState.message ? (
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              {challengeQuestionsBatchState.message}
            </p>
          ) : null}
          {challengeQuestionsSkippedGroups.length > 0 ? (
            <ul className="grid gap-1 text-sm text-[color:var(--app-fg-muted)]">
              {challengeQuestionsSkippedGroups.map((entry) => (
                <li key={entry.groupId}>
                  {entry.groupName}: {entry.reason}
                </li>
              ))}
            </ul>
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
                            aria-label={t.renameGroupLabel.replace('{name}', group.groupName)}
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
                          aria-label={t.renameGroupLabel.replace('{name}', group.groupName)}
                          className="absolute right-2 top-1/2 z-30 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--app-fg-muted)] opacity-70 transition hover:text-[color:var(--app-fg)] hover:opacity-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditingGroup(group.groupId, group.groupName);
                          }}
                          title={t.renameGroup}
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
                      {t.roster}
                    </button>
                  </div>
                }
                description={
                  <>
                    <p>
                      {selectedGroup.presentationOrder
                        ? t.presentationOrder.replace('{order}', String(selectedGroup.presentationOrder))
                        : t.presentationOrderNotLocked}
                    </p>
                    <p>
                      {selectedGroup.submissionTitle
                        ? t.submission.replace('{title}', selectedGroup.submissionTitle)
                        : t.noSubmissionUploaded}
                    </p>
                  </>
                }
                title={t.groupDetails}
                titleLabel={t.groupDetails}
                titleClassName="text-2xl font-semibold"
              >
                <div className="grid gap-4">
                  <CollapsiblePanel
                    actions={
                      <div className="text-right text-sm text-[color:var(--app-fg-muted)]">
                        <div>{scoreStateLabel(saveStates[selectedGroup.groupId] ?? { kind: 'idle' }, uiLanguage, mounted)}</div>
                        <div>
                          {t.finalized}{' '}
                          {selectedGroup.submittedAt ? getTimestampLabel(selectedGroup.submittedAt, uiLanguage, mounted) : t.no}
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
                    title={t.scoringAndFeedback}
                    description={t.poweredBy}
                    titleClassName="text-lg font-semibold"
                  >
                    <label className="grid gap-2 text-sm font-medium">
                      <span className="flex items-center gap-2">
                        <span>{t.writePresentationNotes}</span>
                        <AutoSaveIndicatorIcon
                          ariaLabel={uiLanguage === 'fr' ? 'Forcer l’enregistrement des notes de présentation' : 'Force-save presentation notes'}
                          disabled={groupSaveState.kind === 'saving'}
                          onClick={() => {
                            void persistGroupTextNow(selectedGroup.groupId);
                          }}
                          state={groupSaveState}
                          title={groupIndicatorTitle}
                        />
                      </span>
                      <textarea
                        className="ui-textarea min-h-[140px]"
                        onChange={(event) =>
                          updateGroupText(selectedGroup.groupId, (current) => ({
                            ...current,
                            presentationComments: event.target.value
                          }))
                        }
                        placeholder={t.writePresentationNotes}
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
                              ? t.generatingQuestions
                              : selectedGroupHasChallengeQuestions
                                ? t.regenerateQuestions
                                : t.generateQuestions}
                          </button>
                        ) : null
                      }
                      contentClassName="gap-3"
                      description={challengeQuestionsDescription}
                      open={challengeOpen}
                      onOpenChange={(open) =>
                        setGroupPanelState(selectedGroup.groupId, (current) => ({
                          ...current,
                          challengeOpen: open
                        }))
                      }
                      title={t.challengeQuestions}
                      titleClassName="text-base font-semibold"
                    >
                      {selectedGroupUploadNotice ? (
                        <div
                          aria-live="polite"
                          className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-sm text-[color:var(--app-success)]"
                        >
                          {selectedGroupUploadNotice}
                        </div>
                      ) : null}

                      {selectedGroupHasUploadedWork ? (
                        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-sm text-[color:var(--app-fg-muted)]">
                          {challengeQuestionsDescription}
                        </div>
                      ) : null}

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
                          {t.generatingQuestions}
                        </div>
                      ) : !selectedGroupHasUploadedWork ? (
                        <GroupSubmissionDropzone
                          fileName={selectedGroup.submissionTitle}
                          groupId={selectedGroup.groupId}
                          groupName={t.thisGroup}
                          onUploadSuccess={({ fileName, message, submissionId, submittedAt }) => {
                            setUploadNoticeByGroupId((current) => ({
                              ...current,
                              [selectedGroup.groupId]: message
                            }));
                            setGroups((current) =>
                              current.map((group) =>
                                group.groupId === selectedGroup.groupId
                                  ? {
                                      ...group,
                                      aiLastError: null,
                                      submissionId: submissionId ?? group.submissionId,
                                      submissionTitle: fileName,
                                      submittedAt
                                    }
                                  : group
                              )
                            );
                          }}
                          sessionId={sessionId}
                          submittedAt={selectedGroup.submittedAt}
                          uploadBehavior="inline-api"
                        />
                      ) : selectedGroup.aiStatus === 'failed' ? (
                        <div className="rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-danger)]">
                          {t.couldNotGenerateChallengeQuestions}
                          {selectedGroup.aiLastError ? ` ${selectedGroup.aiLastError}` : ''}
                        </div>
                      ) : null}
                      {showAdminDiagnostics && selectedGroupChallengeQuestionsDebug ? (
                        <div className="grid gap-3 rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-[11px] text-[color:var(--app-fg-muted)]">
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <span>
                              <span className="font-medium text-[color:var(--app-fg)]">
                                promptKeyUsed:
                              </span>{' '}
                              {selectedGroupChallengeQuestionsDebug.promptKeyUsed}
                            </span>
                            <span>
                              <span className="font-medium text-[color:var(--app-fg)]">
                                usedBranchingAi:
                              </span>{' '}
                              {selectedGroupChallengeQuestionsDebug.usedBranchingAi ? 'true' : 'false'}
                            </span>
                            <span>
                              <span className="font-medium text-[color:var(--app-fg)]">
                                verificationStatus:
                              </span>{' '}
                              {selectedGroupChallengeQuestionsDebug.verificationStatus}
                            </span>
                            <span>
                              <span className="font-medium text-[color:var(--app-fg)]">
                                model:
                              </span>{' '}
                              {selectedGroupChallengeQuestionsDebug.model ?? 'null'}
                            </span>
                            <span>
                              <span className="font-medium text-[color:var(--app-fg)]">
                                provider:
                              </span>{' '}
                              {selectedGroupChallengeQuestionsDebug.provider ?? 'null'}
                            </span>
                          </div>

                          <div>
                            <span className="font-medium text-[color:var(--app-fg)]">
                              fallbackReason:
                            </span>{' '}
                            {selectedGroupChallengeQuestionsDebug.fallbackReason ?? 'null'}
                          </div>

                          <div className="grid gap-1">
                            <span className="font-medium text-[color:var(--app-fg)]">
                              rawModelResponse
                            </span>
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 text-[11px] text-[color:var(--app-fg-muted)]">
                              {selectedGroupChallengeQuestionsDebug.rawModelResponse || 'No raw model response.'}
                            </pre>
                          </div>

                          <div className="grid gap-1">
                            <span className="font-medium text-[color:var(--app-fg)]">
                              parsedQuestionsBeforeValidation
                            </span>
                            <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 text-[11px] text-[color:var(--app-fg-muted)]">
                              {selectedGroupChallengeQuestionsDebug.parsedQuestionsBeforeValidation
                                ? JSON.stringify(
                                    selectedGroupChallengeQuestionsDebug.parsedQuestionsBeforeValidation,
                                    null,
                                    2
                                  )
                                : 'null'}
                            </pre>
                          </div>

                          <div className="grid gap-1">
                            <span className="font-medium text-[color:var(--app-fg)]">
                              questionValidationResults
                            </span>
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 text-[11px] text-[color:var(--app-fg-muted)]">
                              {JSON.stringify(
                                selectedGroupChallengeQuestionsDebug.questionValidationResults,
                                null,
                                2
                              )}
                            </pre>
                          </div>

                          <div>
                            <span className="font-medium text-[color:var(--app-fg)]">
                              questionRejectionReasons:
                            </span>{' '}
                            {selectedGroupChallengeQuestionsDebug.questionRejectionReasons.length > 0
                              ? selectedGroupChallengeQuestionsDebug.questionRejectionReasons.join(' | ')
                              : 'None'}
                          </div>

                          <div className="grid gap-1">
                            <span className="font-medium text-[color:var(--app-fg)]">
                              submissionTextSnippet
                            </span>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 text-[11px] text-[color:var(--app-fg-muted)]">
                              {selectedGroupChallengeQuestionsDebug.submissionTextSnippet || 'No submission text.'}
                            </pre>
                          </div>

                          <div className="grid gap-1">
                            <span className="font-medium text-[color:var(--app-fg)]">
                              submissionAnchorCandidates
                            </span>
                            <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 text-[11px] text-[color:var(--app-fg-muted)]">
                              {JSON.stringify(
                                selectedGroupChallengeQuestionsDebug.submissionAnchorCandidates,
                                null,
                                2
                              )}
                            </pre>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <span>
                              <span className="font-medium text-[color:var(--app-fg)]">
                                primaryAnchor:
                              </span>{' '}
                              {selectedGroupChallengeQuestionsDebug.primaryAnchor}
                            </span>
                            <span>
                              <span className="font-medium text-[color:var(--app-fg)]">
                                secondaryAnchor:
                              </span>{' '}
                              {selectedGroupChallengeQuestionsDebug.secondaryAnchor}
                            </span>
                            <span>
                              <span className="font-medium text-[color:var(--app-fg)]">
                                critiqueAnchor:
                              </span>{' '}
                              {selectedGroupChallengeQuestionsDebug.critiqueAnchor}
                            </span>
                            <span>
                              <span className="font-medium text-[color:var(--app-fg)]">
                                topicFocus:
                              </span>{' '}
                              {selectedGroupChallengeQuestionsDebug.topicFocus}
                            </span>
                          </div>

                          <div className="grid gap-1">
                            <span className="font-medium text-[color:var(--app-fg)]">
                              promptTemplateSnippet
                            </span>
                            <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 text-[11px] text-[color:var(--app-fg-muted)]">
                              {selectedGroupChallengeQuestionsDebug.promptTemplateSnippet || 'No template snippet.'}
                            </pre>
                          </div>

                          <div className="grid gap-1">
                            <span className="font-medium text-[color:var(--app-fg)]">
                              renderedPromptSnippet
                            </span>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 text-[11px] text-[color:var(--app-fg-muted)]">
                              {selectedGroupChallengeQuestionsDebug.renderedPromptSnippet || 'No rendered prompt snippet.'}
                            </pre>
                          </div>
                        </div>
                      ) : null}
                    </CollapsiblePanel>

                    <label className="grid gap-2 text-sm font-medium">
                      <span className="flex items-center gap-2">
                        <span>{t.qaComments}</span>
                        <AutoSaveIndicatorIcon
                          ariaLabel={uiLanguage === 'fr' ? 'Forcer l’enregistrement des commentaires Q&R' : 'Force-save Q&A notes'}
                          disabled={groupSaveState.kind === 'saving'}
                          onClick={() => {
                            void persistGroupTextNow(selectedGroup.groupId);
                          }}
                          state={groupSaveState}
                          title={groupIndicatorTitle}
                        />
                      </span>
                      <textarea
                        className="ui-textarea min-h-[120px]"
                        onChange={(event) =>
                          updateGroupText(selectedGroup.groupId, (current) => ({
                            ...current,
                            qaComments: event.target.value
                          }))
                        }
                        placeholder={t.qaCommentsPlaceholder}
                        value={selectedGroup.qaComments}
                      />
                    </label>

                    <div className="flex justify-end">
                      <span
                        className="inline-flex"
                        title={
                          selectedGroupHasFeedbackInputs
                            ? t.sendingNotes
                            : t.addCommentsFirst
                        }
                      >
                        <button
                          className="ui-button ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!selectedGroupHasFeedbackInputs || selectedGroup.aiStatus === 'generating'}
                          onClick={() => void generateGroupFeedback(selectedGroup.groupId)}
                          type="button"
                        >
                          {selectedGroup.aiStatus === 'generating'
                            ? t.generatingFeedback
                            : t.generateFeedback}
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
                          {t.resetScores}
                        </button>
                        <button
                          className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!selectedGroup.readyForFinalization}
                          onClick={() => void finalizeGroup(selectedGroup.groupId)}
                          type="button"
                        >
                          {t.markReadyForExport}
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
                    title={t.finalGrading}
                    titleClassName="text-lg font-semibold"
                  >
                    <div className="grid gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{t.aiStatus}</span>
                        <span className="ui-chip">
                          {getAiStatusLabel(selectedGroup.aiStatus, uiLanguage)}
                        </span>
                      </div>
                      {selectedGroup.aiLastError ? (
                        <p className="text-[color:var(--app-danger)]">{selectedGroup.aiLastError}</p>
                      ) : null}
                      {selectedGroup.aiGeneratedAt ? (
                        <p className="text-[color:var(--app-fg-muted)]">
                          {t.generated} {getTimestampLabel(selectedGroup.aiGeneratedAt, uiLanguage, mounted)}
                        </p>
                      ) : null}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
                      <table className="w-full border-collapse text-sm">
                        <thead className="bg-[color:var(--app-surface-muted)] text-left">
                          <tr>
                            <th className="px-3 py-3 font-medium">{t.criterion}</th>
                            <th className="px-3 py-3 font-medium">{t.finalScore}</th>
                            <th className="px-3 py-3 font-medium">{t.max}</th>
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
                        <span className="font-medium">{t.finalTotal}</span>
                        <span className="ui-chip">
                          {formatScoreTotal(selectedGroupTotal)}/{formatScoreTotal(selectedGroupMaxTotal)}
                        </span>
                      </div>
                      <p className="text-[color:var(--app-fg-muted)]">
                        {uiLanguage === 'fr'
                          ? 'Le total est calculé à partir des notes contrôlées par l’enseignant ci-dessus.'
                          : 'The total is calculated from the teacher-controlled scores above.'}
                      </p>
                    </div>

                    <section className="grid gap-4 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="ui-section-title">{t.finalFeedback}</p>
                          <h4 className="text-base font-semibold">{t.editableSummary}</h4>
                        </div>
                        {selectedGroupCanSpellCheck ? (
                          <button
                            className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => void runSpellCheck(selectedGroup.groupId)}
                            type="button"
                          >
                            {t.spellCheckFeedback}
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
                          ['strengths', t.strengths],
                          ['development', t.development],
                          ['general', t.general]
                        ].map(([key, label]) => (
                          <label key={key} className="grid gap-2 text-sm font-medium">
                            <span className="flex items-center gap-2">
                              <span>{label}</span>
                              <AutoSaveIndicatorIcon
                                ariaLabel={
                                  uiLanguage === 'fr'
                                    ? `Forcer l’enregistrement de ${label}`
                                    : `Force-save ${label}`
                                }
                                disabled={groupSaveState.kind === 'saving'}
                                onClick={() => {
                                  void persistGroupTextNow(selectedGroup.groupId);
                                }}
                                state={groupSaveState}
                                title={groupIndicatorTitle}
                              />
                            </span>
                            <textarea
                              className="ui-textarea min-h-[120px]"
                              onChange={(event) => {
                                setSpellcheckReady((current) => ({
                                  ...current,
                                  [selectedGroup.groupId]: true
                                }));
                                updateGroupText(selectedGroup.groupId, (current) => {
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
          <h2 className="text-lg font-semibold">{t.noGroupsAvailable}</h2>
          <p className="mt-2 text-sm text-[color:var(--app-fg-muted)]">{t.noGroupsHelp}</p>
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
