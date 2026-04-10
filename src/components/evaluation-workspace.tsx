'use client';

import { useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
  submissionTitle: string | null;
  totalScore: number | null;
};

type EvaluationWorkspaceClientProps = {
  groups: SerializableGroup[];
  initialGroupId: string;
  sessionId: string;
  sessionLanguage: string;
  sessionTitle: string;
  sessionMetadata: {
    className: string;
    professorName: string;
    programme: string;
    season: string;
    sessionDate: string;
    subject: string;
  };
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

function buildFeedbackString(sections: EvaluationAiFeedbackSections, language: string) {
  return formatFeedbackSections(sections, language);
}

function sectionEquals(left: EvaluationAiFeedbackSections, right: EvaluationAiFeedbackSections) {
  return (
    left.strengths.trim() === right.strengths.trim() &&
    left.development.trim() === right.development.trim() &&
    left.general.trim() === right.general.trim()
  );
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

function initialDraftGroups(groups: SerializableGroup[]) {
  return groups.map((group) => ({
    ...group,
    criteria: group.criteria.map((criterion) => ({ ...criterion }))
  }));
}

export function EvaluationWorkspaceClient({
  groups: initialGroups,
  initialGroupId,
  sessionId,
  sessionLanguage,
  sessionMetadata,
  sessionTitle
}: EvaluationWorkspaceClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<GroupDraft[]>(() => initialDraftGroups(initialGroups));
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
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
  const selectedAiFeedback = selectedGroup?.aiRecommendedFeedback ?? null;
  const previousGroup = selectedIndex > 0 ? groups[selectedIndex - 1] : null;
  const nextGroup = selectedIndex < groups.length - 1 ? groups[selectedIndex + 1] : null;
  const orderReady = groups.some((group) => group.presentationOrder !== null);

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

  async function generateAi(groupId: string) {
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

      setSaveStates((current) => ({ ...current, [groupId]: { kind: 'saved', at: new Date().toISOString() } }));
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
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="ui-panel grid gap-4 p-4">
        <div className="space-y-1">
          <p className="ui-section-title">Presentation order</p>
          <h2 className="text-lg font-semibold">Navigate by group</h2>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            Step 4 keeps the presentation order visible while you take notes and grade.
          </p>
        </div>

        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Order status</span>
            <span className="ui-chip">{orderReady ? 'Ordered' : 'Using creation order'}</span>
          </div>
          <p className="mt-2 text-[color:var(--app-fg-muted)]">
            Current group, previous group, and next group are shown in the workspace.
          </p>
        </div>

        <div className="grid gap-2">
          {groups.map((group, index) => {
            const isActive = group.groupId === selectedGroupId;
            const saveState = saveStates[group.groupId] ?? { kind: 'idle' as const };

            return (
              <button
                key={group.groupId}
                className={`grid gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
                    : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] hover:border-[color:var(--app-accent)]'
                }`}
                onClick={() => {
                  setSelectedGroupId(group.groupId);
                  updateUrl(group.groupId);
                }}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="ui-chip">#{group.presentationOrder ?? index + 1}</span>
                  <span className="ui-chip">{saveState.kind}</span>
                </div>
                <div className="text-sm font-medium">{group.groupName}</div>
                <div className="text-xs text-[color:var(--app-fg-muted)]">
                  {group.members.length} students
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="grid gap-4">
        {selectedGroup ? (
          <>
            <div className="ui-panel grid gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="ui-section-title">Current group</p>
                  <h2 className="text-2xl font-semibold">{selectedGroup.groupName}</h2>
                  <p className="text-sm text-[color:var(--app-fg-muted)]">
                    {selectedGroup.presentationOrder
                      ? `Presentation order ${selectedGroup.presentationOrder}.`
                      : 'Presentation order not locked yet.'}{' '}
                    {selectedGroup.submissionTitle
                      ? `Submission: ${selectedGroup.submissionTitle}.`
                      : 'No submission uploaded yet.'}
                  </p>
                </div>

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
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                  <p className="ui-section-title">Previous</p>
                  <p className="mt-2 text-sm font-medium">
                    {previousGroup ? previousGroup.groupName : 'None'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] p-4">
                  <p className="ui-section-title">Current</p>
                  <p className="mt-2 text-sm font-medium">{selectedGroup.groupName}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                  <p className="ui-section-title">Next</p>
                  <p className="mt-2 text-sm font-medium">{nextGroup ? nextGroup.groupName : 'None'}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="grid gap-4">
                <section className="ui-panel grid gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="ui-section-title">Teacher notes</p>
                      <h3 className="text-lg font-semibold">Capture notes live</h3>
                    </div>
                    <div className="text-right text-sm text-[color:var(--app-fg-muted)]">
                      <div>{scoreStateLabel(saveStates[selectedGroup.groupId] ?? { kind: 'idle' })}</div>
                      <div>Finalized: {selectedGroup.submittedAt ? getTimestampLabel(selectedGroup.submittedAt) : 'No'}</div>
                    </div>
                  </div>

                  <div className="grid gap-4">
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
                  </div>
                </section>

                <section className="ui-panel grid gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="ui-section-title">Final grading</p>
                      <h3 className="text-lg font-semibold">Teacher-controlled scores</h3>
                    </div>
                    <button
                      className="ui-button ui-button-secondary"
                      disabled={!selectedGroup.readyForFinalization}
                      onClick={() => void finalizeGroup(selectedGroup.groupId)}
                      type="button"
                    >
                      Mark ready for export
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-[color:var(--app-surface-muted)] text-left">
                        <tr>
                          <th className="px-3 py-3 font-medium">Criterion</th>
                          <th className="px-3 py-3 font-medium">AI recommendation</th>
                          <th className="px-3 py-3 font-medium">Final score</th>
                          <th className="px-3 py-3 font-medium">Max</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGroup.criteria.map((criterion) => {
                          const aiRecommendation = selectedGroup.aiRecommendedCriteria.find(
                            (entry) => entry.criterionId === criterion.id
                          );

                          return (
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
                                {aiRecommendation ? (
                                  <div className="space-y-1">
                                    <div className="font-medium">
                                      {aiRecommendation.recommendedScore}/{criterion.maxScore}
                                    </div>
                                    <div className="text-xs text-[color:var(--app-fg-muted)]">
                                      {aiRecommendation.rationale}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-[color:var(--app-fg-muted)]">Not generated</span>
                                )}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <input
                                  className="ui-input w-24"
                                  max={criterion.maxScore}
                                  min={0}
                                  onChange={(event) => {
                                    const parsed = event.target.value === '' ? null : Number(event.target.value);
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">Final total</span>
                      <span className="ui-chip">
                        {selectedGroup.totalScore ?? 0}/{selectedGroup.criteria.reduce(
                          (sum, criterion) => sum + criterion.maxScore,
                          0
                        )}
                      </span>
                    </div>
                    <p className="text-[color:var(--app-fg-muted)]">
                      The total is calculated from the teacher-controlled scores above.
                    </p>
                  </div>
                </section>

                <section className="ui-panel grid gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="ui-section-title">Final feedback</p>
                      <h3 className="text-lg font-semibold">Teacher-controlled summary</h3>
                    </div>
                    {selectedAiFeedback &&
                    !sectionEquals(selectedGroup.finalFeedbackSections, selectedAiFeedback) ? (
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
                      ['strengths', 'Strengths / Points forts'],
                      ['development', 'Development / Axes de développement'],
                      ['general', 'General feedback / Commentaire général']
                    ].map(([key, label]) => (
                      <label key={key} className="grid gap-2 text-sm font-medium">
                        {label}
                        <textarea
                          className="ui-textarea min-h-[120px]"
                          onChange={(event) =>
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
                            })
                          }
                          value={selectedGroup.finalFeedbackSections[key as keyof EvaluationAiFeedbackSections]}
                        />
                      </label>
                    ))}
                  </div>
                </section>
              </div>

              <div className="grid gap-4">
                <section className="ui-panel grid gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="ui-section-title">AI support</p>
                      <h3 className="text-lg font-semibold">Generate per group</h3>
                    </div>
                    <button
                      className="ui-button ui-button-primary"
                      onClick={() => void generateAi(selectedGroup.groupId)}
                      type="button"
                    >
                      {selectedGroup.aiStatus === 'generating' ? 'Generating...' : 'Send notes to AI'}
                    </button>
                  </div>

                  <div className="grid gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Status</span>
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

                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Challenge questions</p>
                      {selectedGroup.aiRecommendedQuestions.length > 0 ? (
                        <ul className="grid gap-2 text-sm text-[color:var(--app-fg-muted)]">
                          {selectedGroup.aiRecommendedQuestions.map((question, index) => (
                            <li key={`${question}-${index}`} className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2">
                              {question}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-[color:var(--app-fg-muted)]">No AI questions yet.</p>
                      )}
                    </div>

                    {selectedAiFeedback ? (
                      <div className="grid gap-3">
                        {[
                          ['strengths', 'AI strengths'],
                          ['development', 'AI development areas'],
                          ['general', 'AI general feedback']
                        ].map(([key, label]) => (
                          <div key={key} className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                            <p className="text-sm font-medium">{label}</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--app-fg-muted)]">
                              {selectedAiFeedback[key as keyof EvaluationAiFeedbackSections]}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[color:var(--app-fg-muted)]">
                        AI feedback will appear here after generation.
                      </p>
                    )}
                  </div>
                </section>

                <section className="ui-panel grid gap-4 p-5">
                  <div className="space-y-1">
                    <p className="ui-section-title">Group roster</p>
                    <h3 className="text-lg font-semibold">Who is presenting</h3>
                  </div>

                  <div className="grid gap-2">
                    {selectedGroup.members.map((member) => (
                      <div
                        key={member.id}
                        className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-sm"
                      >
                        <div className="font-medium">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-[color:var(--app-fg-muted)]">{member.schoolEmail}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="ui-panel grid gap-4 p-5">
                  <div className="space-y-1">
                    <p className="ui-section-title">Workspace metadata</p>
                    <h3 className="text-lg font-semibold">{sessionTitle}</h3>
                  </div>

                  <div className="grid gap-3 text-sm">
                    {[
                      ['Professor', sessionMetadata.professorName],
                      ['Programme', sessionMetadata.programme],
                      ['Class', sessionMetadata.className],
                      ['Subject', sessionMetadata.subject],
                      ['Season', sessionMetadata.season],
                      ['Session date', sessionMetadata.sessionDate]
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3">
                        <span className="text-[color:var(--app-fg-muted)]">{label}</span>
                        <span className="font-medium">{value || 'Not set'}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </>
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
  );
}
