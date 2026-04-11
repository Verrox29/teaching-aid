'use client';

import { useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { CollapsiblePanel } from '@/components/collapsible-panel';
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
  gradingOpen: boolean;
  notesOpen: boolean;
};

type BatchState = {
  kind: 'idle' | 'running' | 'done' | 'failed';
  message: string;
};

type WorkspaceSectionKey = 'currentGroup' | 'order' | 'workflow';

type BatchActionProps = {
  disabled: boolean;
  onClick: () => void;
  statusLabel?: string;
  tooltipBody: string;
  tooltipTitle: string;
  variant: 'primary' | 'secondary';
  children: ReactNode;
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

function BatchActionButton({
  children,
  disabled,
  onClick,
  statusLabel,
  tooltipBody,
  tooltipTitle,
  variant
}: BatchActionProps) {
  return (
    <span className="group relative inline-flex">
      <button
        className={`ui-button ui-button-${variant} disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:transform-none`}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-80 -translate-x-1/2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-left text-xs shadow-lg group-hover:block group-focus-within:block">
        <span className="block font-semibold text-[color:var(--app-fg)]">{tooltipTitle}</span>
        <span className="mt-1 block leading-5 text-[color:var(--app-fg-muted)]">{tooltipBody}</span>
        {statusLabel ? <span className="mt-2 block text-[color:var(--app-fg-muted)]">{statusLabel}</span> : null}
      </span>
    </span>
  );
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
      const hasExistingAi =
        Boolean(group.aiRecommendedFeedback) ||
        group.aiRecommendedCriteria.length > 0 ||
        group.finalFeedback.trim().length > 0;

      return [
        group.groupId,
        {
          gradingOpen: hasExistingAi,
          notesOpen: !hasExistingAi
        } satisfies PanelState
      ];
    })
  ) as Record<string, PanelState>;
}

export function EvaluationWorkspaceClient({
  groups: initialGroups,
  initialGroupId,
  sessionId,
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
  const [sectionOpen, setSectionOpen] = useState<Record<WorkspaceSectionKey, boolean>>({
    currentGroup: true,
    order: true,
    workflow: true
  });
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

  const selectedIndex = Math.max(
    0,
    groups.findIndex((group) => group.groupId === selectedGroupId)
  );
  const selectedGroup = groups[selectedIndex] ?? groups[0] ?? null;
  const selectedGroupPanelState = selectedGroup ? panelStates[selectedGroup.groupId] : null;
  const notesOpen = selectedGroupPanelState?.notesOpen ?? true;
  const gradingOpen = selectedGroupPanelState?.gradingOpen ?? false;
  const selectedGroupHasUploadedWork = Boolean(selectedGroup?.submissionId);
  const selectedGroupHasPresentationComments = Boolean(selectedGroup?.presentationComments.trim());
  const selectedGroupChallengeQuestionSkip =
    selectedGroup && challengeQuestionsSkipped[selectedGroup.groupId]
      ? challengeQuestionsSkipped[selectedGroup.groupId]
      : null;
  const selectedGroupHasChallengeQuestions = Boolean(selectedGroup?.aiRecommendedQuestions.length);
  const selectedGroupCanSpellCheck = Boolean(
    selectedGroup?.aiRecommendedFeedback && spellcheckReady[selectedGroup?.groupId ?? '']
  );
  const uploadedGroups = groups.filter((group) => Boolean(group.submissionId));
  const canRunChallengeQuestions = uploadedGroups.length > 0;
  const canRunBatchGrading =
    uploadedGroups.length > 0 &&
    uploadedGroups.every((group) => Boolean(group.presentationComments.trim()));
  const selectedGroupTotal = selectedGroup
    ? selectedGroup.criteria.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0)
    : 0;
  const selectedGroupMaxTotal = selectedGroup
    ? selectedGroup.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0)
    : 0;
  const previousGroup = selectedIndex > 0 ? groups[selectedIndex - 1] : null;
  const nextGroup = selectedIndex < groups.length - 1 ? groups[selectedIndex + 1] : null;
  const orderReady = groups.some((group) => group.presentationOrder !== null);

  function setSectionVisibility(section: WorkspaceSectionKey, open: boolean) {
    setSectionOpen((current) => ({ ...current, [section]: open }));
  }

  function updateUrl(groupId: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('groupId', groupId);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
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
          current.map((group) => (group.groupId === groupId ? payload.group : group))
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
          gradingOpen: false,
          notesOpen: true
        }
      )
    }));
  }

  function openGradingForGroup(groupId: string) {
    setGroupPanelState(groupId, () => ({
      gradingOpen: true,
      notesOpen: false
    }));
  }

  async function generateGroupFeedback(groupId: string) {
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
      openGradingForGroup(groupId);
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
        const nextSkipped = Object.fromEntries(
          skipped.map((entry: { groupId: string; reason: string }) => [entry.groupId, entry.reason])
        );
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

  return (
    <div className="grid gap-4">
      <CollapsiblePanel
        description="Step 4 is the live evaluation workspace. Presentation order is visible here. Teacher notes autosave, batch AI actions sit at the top, and the final score remains teacher-controlled."
        open={sectionOpen.workflow}
        onOpenChange={(open) => setSectionVisibility('workflow', open)}
        title="AI workflow"
      >
        <div className="flex flex-wrap items-center gap-2">
          <BatchActionButton
            disabled={!canRunChallengeQuestions || challengeQuestionsBatchState.kind === 'running'}
            onClick={() => void runBatchAi('questions')}
            statusLabel={
              challengeQuestionsBatchState.kind === 'running' ? 'Generating challenge questions...' : undefined
            }
            tooltipBody="Uses each uploaded work to create specific challenge questions about rationale, assumptions, evidence, and trade-offs."
            tooltipTitle="Challenge questions"
            variant="secondary"
          >
            {challengeQuestionsBatchState.kind === 'running'
              ? 'Generating questions...'
              : 'Generate AI challenge questions'}
          </BatchActionButton>
          <BatchActionButton
            disabled={!canRunBatchGrading || gradingBatchState.kind === 'running'}
            onClick={() => void runBatchAi('grading')}
            statusLabel={
              gradingBatchState.kind === 'running' ? 'Generating feedback and grades...' : undefined
            }
            tooltipBody="Generates conservative grade recommendations and editable feedback for groups with presentation comments."
            tooltipTitle="Late grading"
            variant="primary"
          >
            {gradingBatchState.kind === 'running'
              ? 'Generating feedback...'
              : 'Generate AI feedback & grades for all groups'}
          </BatchActionButton>
        </div>

        {challengeQuestionsBatchState.message || gradingBatchState.message ? (
          <div className="grid gap-1 text-sm text-[color:var(--app-fg-muted)]">
            {challengeQuestionsBatchState.message ? (
              <p>Challenge questions: {challengeQuestionsBatchState.message}</p>
            ) : null}
            {gradingBatchState.message ? <p>Late grading: {gradingBatchState.message}</p> : null}
          </div>
        ) : null}
      </CollapsiblePanel>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <CollapsiblePanel
          className="h-fit"
          description="Groups appear as a compact row. Click one to open its workspace."
          actions={<span className="ui-chip">{orderReady ? 'Ordered' : 'Using creation order'}</span>}
          contentClassName="gap-2"
          open={sectionOpen.order}
          onOpenChange={(open) => setSectionVisibility('order', open)}
          title="Presentation order"
        >
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
            {groups.map((group, index) => {
              const isActive = group.groupId === selectedGroupId;

              return (
                <button
                  key={group.groupId}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                    isActive
                      ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)]'
                      : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-fg)] hover:border-[color:var(--app-accent)]'
                  }`}
                  onClick={() => {
                    setSelectedGroupId(group.groupId);
                    updateUrl(group.groupId);
                  }}
                  type="button"
                >
                  <span className="ui-chip px-2 py-1">#{group.presentationOrder ?? index + 1}</span>
                  <span className="max-w-[12rem] truncate font-medium">{group.groupName}</span>
                  {isActive ? <span className="ui-chip ui-chip-accent px-2 py-1">Current</span> : null}
                </button>
              );
            })}
          </div>
        </CollapsiblePanel>

        <section className="grid gap-4">
          {selectedGroup ? (
            <CollapsiblePanel
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {previousGroup ? (
                    <button
                      className="ui-button ui-button-secondary"
                      onClick={() => {
                        setSelectedGroupId(previousGroup.groupId);
                        updateUrl(previousGroup.groupId);
                      }}
                      type="button"
                    >
                      Previous
                    </button>
                  ) : null}
                  {nextGroup ? (
                    <button
                      className="ui-button ui-button-secondary"
                      onClick={() => {
                        setSelectedGroupId(nextGroup.groupId);
                        updateUrl(nextGroup.groupId);
                      }}
                      type="button"
                    >
                      Next
                    </button>
                  ) : null}
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
              open={sectionOpen.currentGroup}
              onOpenChange={(open) => setSectionVisibility('currentGroup', open)}
              title={selectedGroup.groupName}
              titleClassName="text-2xl font-semibold"
            >
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-sm">
                <span className="ui-chip">Previous: {previousGroup ? previousGroup.groupName : 'None'}</span>
                <span className="ui-chip ui-chip-accent">Current: {selectedGroup.groupName}</span>
                <span className="ui-chip">Next: {nextGroup ? nextGroup.groupName : 'None'}</span>
              </div>

              <div className="grid gap-4">
                <CollapsiblePanel
                  actions={
                    <div className="text-right text-sm text-[color:var(--app-fg-muted)]">
                      <div>{scoreStateLabel(saveStates[selectedGroup.groupId] ?? { kind: 'idle' })}</div>
                      <div>
                        Finalized: {selectedGroup.submittedAt ? getTimestampLabel(selectedGroup.submittedAt) : 'No'}
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
                  title="Teacher notes"
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

                  {selectedGroupHasChallengeQuestions ? (
                    <div className="grid gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                      <p className="ui-section-title">AI challenge questions</p>
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
                    </div>
                  ) : selectedGroupChallengeQuestionSkip ? (
                    <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm text-[color:var(--app-fg-muted)]">
                      Challenge questions unavailable: {selectedGroupChallengeQuestionSkip}
                    </div>
                  ) : selectedGroupHasUploadedWork ? (
                    <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm text-[color:var(--app-fg-muted)]">
                      Run the top-level challenge-question action to generate prompts for this group.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm text-[color:var(--app-fg-muted)]">
                      No uploaded work is available for challenge questions.
                    </div>
                  )}

                  <div className="flex justify-end">
                    <span
                      className="inline-flex"
                      title={
                        selectedGroupHasPresentationComments
                          ? 'Send the presentation notes to AI for structured feedback and conservative grade suggestions.'
                          : 'Add presentation comments before generating AI feedback and grades.'
                      }
                    >
                      <button
                        className="ui-button ui-button-primary"
                        disabled={!selectedGroupHasPresentationComments || selectedGroup.aiStatus === 'generating'}
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
                    <button
                      className="ui-button ui-button-secondary"
                      disabled={!selectedGroup.readyForFinalization}
                      onClick={() => void finalizeGroup(selectedGroup.groupId)}
                      type="button"
                    >
                      Mark ready for export
                    </button>
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
                          className="ui-button ui-button-secondary"
                          onClick={() => void runSpellCheck(selectedGroup.groupId)}
                          type="button"
                        >
                          Spell-check feedback
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-4">
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
          ) : (
            <section className="ui-panel p-6">
              <h2 className="text-lg font-semibold">No groups available</h2>
              <p className="mt-2 text-sm text-[color:var(--app-fg-muted)]">
                Create or assign groups before using the evaluation workspace.
              </p>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}
