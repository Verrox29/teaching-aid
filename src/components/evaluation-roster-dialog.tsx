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

export function EvaluationRosterDialog({
  groups,
  groupId,
  onClose,
  open,
  sessionId
}: EvaluationRosterDialogProps) {
  const router = useRouter();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [destinationGroupId, setDestinationGroupId] = useState<string>('');
  const [adjustmentValue, setAdjustmentValue] = useState('1');
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
    setDestinationGroupId(
      groups.find((group) => group.groupId !== groupId && group.members.length < group.capacity)?.groupId ??
        ''
    );
    setAdjustmentValue('1');
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
    onClose();
  }

  async function applyAdjustment(sign: 1 | -1) {
    if (!selectedStudent) {
      return;
    }

    const parsed = Number.parseFloat(adjustmentValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setStatus('Enter a positive adjustment amount.');
      return;
    }

    const adjustment = Number((parsed * sign).toFixed(1));
    try {
      await sendAction({
        action: 'adjust',
        adjustment,
        sessionStudentId: selectedStudent.id
      });
    } catch (error) {
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
          className="w-[min(52rem,calc(100vw-2rem))] rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-lg"
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
                        <span className="ui-chip px-2 py-1">{formatAdjustment(member.gradeAdjustment)}</span>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--app-fg-muted)]">{member.schoolEmail}</p>
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
                      Adjustment: <span className="font-medium text-[color:var(--app-fg)]">{formatAdjustment(selectedStudent.gradeAdjustment)}</span>
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
                    <p className="ui-section-title">Grade adjustment</p>
                    <label className="grid gap-2 text-sm font-medium">
                      Points
                      <input
                        className="ui-input w-full"
                        min="0"
                        step="0.5"
                        type="number"
                        value={adjustmentValue}
                        onChange={(event) => setAdjustmentValue(event.target.value)}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button className="ui-button ui-button-secondary" onClick={() => void applyAdjustment(1)} type="button">
                        Bonus points
                      </button>
                      <button className="ui-button ui-button-secondary" onClick={() => void applyAdjustment(-1)} type="button">
                        Penalty points
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 text-sm text-[color:var(--app-fg-muted)]">
                  Select a student to move them, remove them, or apply a grade adjustment.
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
