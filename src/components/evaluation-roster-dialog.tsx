'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { EvaluationGroupMember } from '@/lib/evaluation/types';

type RosterGroup = {
  capacity: number;
  groupId: string;
  groupName: string;
  members: EvaluationGroupMember[];
};

type EvaluationRosterDialogProps = {
  groups: RosterGroup[];
  groupId: string;
  groupTotal: number | null;
  onClose: () => void;
  open: boolean;
  sessionId: string;
};

function formatAdjustment(value: number) {
  const abs = Math.abs(value);
  const formatted = Number.isInteger(abs) ? `${abs}` : abs.toFixed(1);
  if (value === 0) {
    return '0';
  }
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

function formatGrade(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function EvaluationRosterDialog({
  groups,
  groupId,
  groupTotal,
  onClose,
  open,
  sessionId
}: EvaluationRosterDialogProps) {
  const router = useRouter();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [destinationGroupId, setDestinationGroupId] = useState<string>('');
  const [adjustmentValue, setAdjustmentValue] = useState('');
  const [draftAdjustments, setDraftAdjustments] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<string>('');

  const currentGroup = groups.find((group) => group.groupId === groupId) ?? null;
  const selectedStudent =
    currentGroup?.members.find((member) => member.id === selectedStudentId) ?? currentGroup?.members[0] ?? null;

  useEffect(() => {
    if (!open) {
      setStatus('');
      return;
    }

    setSelectedStudentId(currentGroup?.members[0]?.id ?? '');
    setDraftAdjustments(
      Object.fromEntries(
        (currentGroup?.members ?? []).map((member) => [member.id, member.gradeAdjustment])
      )
    );
    setDestinationGroupId(
      groups.find((group) => group.groupId !== groupId && group.members.length < group.capacity)?.groupId ??
        ''
    );
    setAdjustmentValue('');
    setStatus('');
  }, [currentGroup, groupId, groups, open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (!open || !currentGroup) {
    return null;
  }

  function getAdjustment(memberId: string, fallback: number) {
    return draftAdjustments[memberId] ?? fallback;
  }

  function getFinalGrade(memberId: string, fallback: number) {
    if (groupTotal === null || groupTotal === undefined) {
      return null;
    }

    const adjustment = getAdjustment(memberId, fallback);
    return Math.min(20, Math.max(0, groupTotal + adjustment));
  }

  async function sendAction(payload: Record<string, string | number | null>) {
    setStatus('Saving...');

    const response = await fetch(`/api/sessions/${sessionId}/evaluation/roster`, {
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'PATCH'
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error ?? 'Could not save roster change.');
    }

    router.refresh();
    setStatus('Saved.');
  }

  function parseSignedAdjustment(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed === '+' || trimmed === '-') {
      return null;
    }

    if (!/^[+-]?\d+$/.test(trimmed)) {
      return undefined;
    }

    return Number.parseInt(trimmed, 10);
  }

  async function applyAdjustment(nextValue: string) {
    if (!selectedStudent) {
      return;
    }

    const parsed = parseSignedAdjustment(nextValue);
    if (parsed === undefined) {
      setStatus('Enter a signed whole-number adjustment.');
      return;
    }

    if (parsed === null) {
      return;
    }

    setDraftAdjustments((current) => ({
      ...current,
      [selectedStudent.id]: parsed
    }));

    try {
      await sendAction({
        action: 'adjust',
        adjustment: parsed,
        sessionStudentId: selectedStudent.id
      });
    } catch (error) {
      setDraftAdjustments((current) => ({
        ...current,
        [selectedStudent.id]: selectedStudent.gradeAdjustment
      }));
      setStatus(error instanceof Error ? error.message : 'Could not save roster change.');
    }
  }

  async function moveStudent() {
    if (!selectedStudent || !destinationGroupId) {
      setStatus('Choose a destination group.');
      return;
    }

    try {
      await sendAction({
        action: 'move',
        groupId: destinationGroupId,
        sessionStudentId: selectedStudent.id
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save roster change.');
    }
  }

  async function removeStudent() {
    if (!selectedStudent) {
      return;
    }

    try {
      await sendAction({
        action: 'remove',
        sessionStudentId: selectedStudent.id
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save roster change.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[color:rgba(17,12,25,0.38)] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          aria-modal="true"
          className="w-[min(48rem,calc(100vw-2rem))] rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="ui-section-title">Group roster</p>
              <h2 className="text-xl font-semibold">{currentGroup.groupName}</h2>
            </div>
            <button className="ui-button ui-button-secondary px-3 py-2 text-sm" onClick={onClose} type="button">
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="ui-section-title">Students</p>
                <span className="ui-chip px-2 py-1">{currentGroup.members.length}</span>
              </div>
              <div className="grid gap-2 max-h-[50vh] overflow-auto pr-1">
                {currentGroup.members.map((member) => {
                  const isSelected = member.id === selectedStudent?.id;
                  return (
                    <button
                      key={member.id}
                      className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                        isSelected
                          ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
                          : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] hover:border-[color:var(--app-accent)]'
                      }`}
                      onClick={() => setSelectedStudentId(member.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {member.firstName} {member.lastName}
                        </span>
                        <span className="ui-chip px-2 py-1">
                          {getFinalGrade(member.id, member.gradeAdjustment) === null
                            ? 'No grade'
                            : `Grade ${formatGrade(getFinalGrade(member.id, member.gradeAdjustment) ?? 0)}`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--app-fg-muted)]">
                        {member.schoolEmail} · Adjustment {formatAdjustment(getAdjustment(member.id, member.gradeAdjustment))}
                      </p>
                    </button>
                  );
                })}
                {currentGroup.members.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-sm text-[color:var(--app-fg-muted)]">
                    No students in this group.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
              {selectedStudent ? (
                <>
                  <div className="space-y-1">
                    <p className="ui-section-title">Selected student</p>
                    <h3 className="text-lg font-semibold">
                      {selectedStudent.firstName} {selectedStudent.lastName}
                    </h3>
                    <p className="text-sm text-[color:var(--app-fg-muted)]">{selectedStudent.schoolEmail}</p>
                    <p className="text-sm text-[color:var(--app-fg-muted)]">
                      Adjustment:{' '}
                      <span className="font-medium text-[color:var(--app-fg)]">
                        {formatAdjustment(getAdjustment(selectedStudent.id, selectedStudent.gradeAdjustment))}
                      </span>
                    </p>
                    <p className="text-sm text-[color:var(--app-fg-muted)]">
                      Final grade:{' '}
                      <span className="font-medium text-[color:var(--app-fg)]">
                        {getFinalGrade(selectedStudent.id, selectedStudent.gradeAdjustment) === null
                          ? 'No grade yet'
                          : formatGrade(
                              getFinalGrade(selectedStudent.id, selectedStudent.gradeAdjustment) ?? 0
                            )}
                      </span>
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <label className="grid gap-2 text-sm font-medium">
                      Move to group
                      <select
                        className="ui-select"
                        onChange={(event) => setDestinationGroupId(event.target.value)}
                        value={destinationGroupId}
                      >
                        <option value="">Choose a destination</option>
                        {groups
                          .filter((group) => group.groupId !== currentGroup.groupId)
                          .map((group) => {
                            const remainingSeats = group.capacity - group.members.length;
                            return (
                              <option key={group.groupId} value={group.groupId} disabled={remainingSeats <= 0}>
                                {group.groupName} ({remainingSeats} left)
                              </option>
                            );
                          })}
                      </select>
                    </label>
                    <button className="ui-button ui-button-primary" onClick={() => void moveStudent()} type="button">
                      Move student
                    </button>
                    <button className="ui-button ui-button-secondary" onClick={() => void removeStudent()} type="button">
                      Remove from all groups
                    </button>
                  </div>

                  <div className="grid gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3">
                    <p className="ui-section-title">Individual grading</p>
                    <label className="grid gap-2 text-sm font-medium">
                      Adjustment
                      <input
                        className="ui-input w-full"
                        inputMode="numeric"
                        pattern="[+-]?[0-9]*"
                        placeholder="+1 or -1"
                        type="text"
                        value={adjustmentValue}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setAdjustmentValue(nextValue);
                          void applyAdjustment(nextValue);
                        }}
                      />
                    </label>
                    <p className="text-xs text-[color:var(--app-fg-muted)]">
                      Apply a signed whole-number adjustment. The student&apos;s final grade stays between 0 and 20.
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 text-sm text-[color:var(--app-fg-muted)]">
                  Select a student to move them, remove them, or apply individual grading.
                </div>
              )}

              {status ? <p className="text-sm text-[color:var(--app-fg-muted)]">{status}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
