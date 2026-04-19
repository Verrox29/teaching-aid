'use client';

import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';

import {
  createGroupAction,
  deleteGroupAction,
  saveGroupsAction
} from '@/app/sessions/[sessionId]/groups/actions';

type StudentRecord = {
  id: string;
  firstName: string;
  lastName: string;
  schoolEmail: string;
};

type InitialGroupRecord = {
  id: string;
  name: string;
  capacity: number;
  members: StudentRecord[];
};

type GroupRecord = {
  id: string;
  name: string;
  capacity: string;
  members: StudentRecord[];
};

type SessionGroupsBoardProps = {
  defaultGroupCapacity: number;
  error?: string;
  errorGroupId?: string;
  errorStudentId?: string;
  groups: InitialGroupRecord[];
  ignoredStudents: StudentRecord[];
  notice?: string;
  sessionId: string;
  sessionTitle: string;
  unassignedStudents: StudentRecord[];
};

type DragState = {
  sessionStudentId: string;
  sourceGroupId: string | null;
};

type AlertState = {
  kind: 'error' | 'notice';
  message: string;
  groupId?: string;
  studentId?: string;
};

type VisibilityActionState =
  | {
      action: 'ignore';
      studentId: string;
    }
  | {
      action: 'restore';
      studentId: string;
    }
  | null;

function compareStudents(left: StudentRecord, right: StudentRecord) {
  const lastName = left.lastName.localeCompare(right.lastName, 'en', { sensitivity: 'base' });
  if (lastName !== 0) {
    return lastName;
  }

  const firstName = left.firstName.localeCompare(right.firstName, 'en', { sensitivity: 'base' });
  if (firstName !== 0) {
    return firstName;
  }

  return left.schoolEmail.localeCompare(right.schoolEmail, 'en', { sensitivity: 'base' });
}

function sortStudentsStable(students: StudentRecord[]) {
  return [...students].sort(compareStudents);
}

function shuffleValues<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function shuffleStudents(students: StudentRecord[]) {
  return shuffleValues(students);
}

function TrashCanIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 6H20L18.4199 20.2209C18.3074 21.2337 17.4512 22 16.4321 22H7.56786C6.54876 22 5.69264 21.2337 5.5801 20.2209L4 6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M7.34491 3.14716C7.67506 2.44685 8.37973 2 9.15396 2H14.846C15.6203 2 16.3249 2.44685 16.6551 3.14716L18 6H6L7.34491 3.14716Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M2 6H22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M10 11V16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M14 11V16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function groupSnapshot(group: GroupRecord) {
  return {
    name: group.name.trim(),
    capacity: group.capacity.trim(),
    memberIds: group.members.map((student) => student.id)
  };
}

function areMemberIdsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function saveAllPayload(groups: GroupRecord[]) {
  return JSON.stringify({
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name.trim(),
      capacity: Number(group.capacity),
      memberIds: group.members.map((student) => student.id)
    }))
  });
}

function copyGroups(groups: InitialGroupRecord[]) {
  return groups.map((group) => ({
    ...group,
    capacity: String(group.capacity),
    members: sortStudentsStable(group.members)
  }));
}

function randomizeGroupMemberships(groups: GroupRecord[], students: StudentRecord[]) {
  const shuffledStudents = shuffleStudents(students);

  const nextGroups = groups.map((group, index) => ({
    ...group,
    members: [] as StudentRecord[],
    order: index
  }));
  const nextUnassignedStudents: StudentRecord[] = [];

  shuffledStudents.forEach((student) => {
    const targetGroup = nextGroups
      .filter((group) => group.members.length < Number(group.capacity))
      .sort((left, right) => {
        const memberCountDelta = left.members.length - right.members.length;
        if (memberCountDelta !== 0) {
          return memberCountDelta;
        }

        return left.order - right.order;
      })[0];

    if (!targetGroup) {
      nextUnassignedStudents.push(student);
      return;
    }

    targetGroup.members.push(student);
  });

  return {
    groups: nextGroups.map(({ order: _order, ...group }) => ({
      ...group,
      members: sortStudentsStable(group.members)
    })),
    unassignedStudents: sortStudentsStable(nextUnassignedStudents)
  };
}

export function SessionGroupsBoard({
  defaultGroupCapacity,
  error,
  errorGroupId,
  errorStudentId,
  groups: initialGroups,
  ignoredStudents: initialIgnoredStudents,
  notice,
  sessionId,
  sessionTitle,
  unassignedStudents: initialUnassignedStudents
}: SessionGroupsBoardProps) {
  const [groups, setGroups] = useState<GroupRecord[]>(() => copyGroups(initialGroups));
  const [unassignedStudents, setUnassignedStudents] = useState<StudentRecord[]>(() =>
    sortStudentsStable(initialUnassignedStudents)
  );
  const [ignoredStudents, setIgnoredStudents] = useState<StudentRecord[]>(() =>
    sortStudentsStable(initialIgnoredStudents)
  );
  const [savedMemberIdsByGroupId, setSavedMemberIdsByGroupId] = useState(
    () =>
      new Map(
        initialGroups.map((group) => [group.id, group.members.map((student) => student.id)])
      )
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isRandomizingStudents, setIsRandomizingStudents] = useState(false);
  const [visibilityActionState, setVisibilityActionState] =
    useState<VisibilityActionState>(null);
  const [isIgnoredDrawerOpen, setIsIgnoredDrawerOpen] = useState(false);
  const [localAlert, setLocalAlert] = useState<AlertState | null>(null);

  const initialGroupMetaSnapshots = useMemo(
    () =>
      new Map(
        initialGroups.map((group) => [
          group.id,
          {
            capacity: String(group.capacity),
            name: group.name.trim()
          }
        ])
      ),
    [initialGroups]
  );

  const groupsJson = useMemo(() => saveAllPayload(groups), [groups]);
  const alert = localAlert ?? (error || notice ? {
    kind: error ? 'error' : 'notice',
    message: error ?? notice ?? '',
    groupId: errorGroupId,
    studentId: errorStudentId
  } : null);

  const totalStudents = groups.reduce((count, group) => count + group.members.length, 0) +
    unassignedStudents.length;
  const assignedStudents = groups.reduce((count, group) => count + group.members.length, 0);
  const totalSeatsRemaining = groups.reduce(
    (count, group) => count + Math.max(0, Number(group.capacity) - group.members.length),
    0
  );
  const hasInvalidGroupCapacity = groups.some(
    (group) => !Number.isFinite(Number(group.capacity)) || Number(group.capacity) < 1
  );

  function getStudentFromGroups(sessionStudentId: string) {
    for (const group of groups) {
      const member = group.members.find((student) => student.id === sessionStudentId);
      if (member) {
        return member;
      }
    }

    return null;
  }

  function getVisibleStudents() {
    return sortStudentsStable([...groups.flatMap((group) => group.members), ...unassignedStudents]);
  }

  function updateMembershipSnapshots(nextGroups: GroupRecord[]) {
    setSavedMemberIdsByGroupId(
      new Map(nextGroups.map((group) => [group.id, group.members.map((student) => student.id)]))
    );
  }

  function applyMembershipState(
    nextGroups: GroupRecord[],
    nextUnassignedStudents: StudentRecord[],
    nextIgnoredStudents: StudentRecord[]
  ) {
    setGroups(nextGroups);
    setUnassignedStudents(sortStudentsStable(nextUnassignedStudents));
    setIgnoredStudents(sortStudentsStable(nextIgnoredStudents));
    updateMembershipSnapshots(nextGroups);
  }

  function moveStudent(
    sessionStudentId: string,
    sourceGroupId: string | null,
    targetGroupId: string | null
  ) {
    setLocalAlert(null);

    if (sourceGroupId === targetGroupId) {
      return;
    }

    const student = sourceGroupId
      ? getStudentFromGroups(sessionStudentId)
      : unassignedStudents.find((entry) => entry.id === sessionStudentId) ?? null;

    if (!student) {
      setLocalAlert({ kind: 'error', message: 'That student could not be found.' });
      return;
    }

    if (targetGroupId) {
      const targetGroup = groups.find((group) => group.id === targetGroupId);
      if (!targetGroup) {
        setLocalAlert({
          kind: 'error',
          message: 'Destination group not found.',
          studentId: sessionStudentId
        });
        return;
      }

      const targetMemberCount =
        targetGroup.id === sourceGroupId
          ? targetGroup.members.length
          : targetGroup.members.length + 1;

      if (targetGroup.id !== sourceGroupId && targetMemberCount > Number(targetGroup.capacity)) {
        setLocalAlert({
          kind: 'error',
          message: `That group is already full.`,
          groupId: targetGroup.id
        });
        return;
      }
    }

    if (sourceGroupId) {
      setGroups((currentGroups) =>
        currentGroups.map((group) =>
          group.id === sourceGroupId
            ? {
                ...group,
                members: sortStudentsStable(
                  group.members.filter((member) => member.id !== sessionStudentId)
                )
              }
            : group
        )
      );
    } else {
      setUnassignedStudents((currentStudents) =>
        sortStudentsStable(currentStudents.filter((member) => member.id !== sessionStudentId))
      );
    }

    if (targetGroupId) {
      setGroups((currentGroups) =>
        currentGroups.map((group) =>
          group.id === targetGroupId
            ? {
                ...group,
                members: sortStudentsStable([...group.members, student])
              }
            : group
        )
      );
    } else {
      setUnassignedStudents((currentStudents) => sortStudentsStable([...currentStudents, student]));
    }
  }

  function handleDestinationChange(
    studentId: string,
    sourceGroupId: string | null,
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    const groupId = event.currentTarget.value;
    if (!groupId) {
      return;
    }

    moveStudent(studentId, sourceGroupId, groupId);
  }

  function handleRemoveClick(studentId: string, sourceGroupId: string) {
    moveStudent(studentId, sourceGroupId, null);
  }

  async function handleRandomizeEnrollment() {
    if (isRandomizingStudents || groups.length === 0 || getVisibleStudents().length === 0) {
      return;
    }

    if (hasInvalidGroupCapacity) {
      setLocalAlert({
        kind: 'error',
        message: 'Fix the group capacities before randomizing enrollment.'
      });
      return;
    }

    const previousGroups = groups.map((group) => ({
      ...group,
      members: [...group.members]
    }));
    const previousUnassignedStudents = [...unassignedStudents];
    const previousIgnoredStudents = [...ignoredStudents];
    const previousSavedMemberIdsByGroupId = new Map(savedMemberIdsByGroupId);
    const randomized = randomizeGroupMemberships(previousGroups, getVisibleStudents());
    const randomizedGroupsJson = saveAllPayload(randomized.groups);

    setLocalAlert(null);
    setIsRandomizingStudents(true);
    applyMembershipState(randomized.groups, randomized.unassignedStudents, previousIgnoredStudents);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/groups/randomize`, {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          groupsJson: randomizedGroupsJson
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not randomize the student enrollment.');
      }

      setLocalAlert({ kind: 'notice', message: 'Student enrollment randomized.' });
    } catch (randomizeError) {
      setGroups(previousGroups);
      setUnassignedStudents(previousUnassignedStudents);
      setIgnoredStudents(previousIgnoredStudents);
      setSavedMemberIdsByGroupId(previousSavedMemberIdsByGroupId);
      setLocalAlert({
        kind: 'error',
        message:
          randomizeError instanceof Error
            ? randomizeError.message
            : 'Could not randomize the student enrollment.'
      });
    } finally {
      setIsRandomizingStudents(false);
    }
  }

  async function handleIgnoreStudent(studentId: string, sourceGroupId: string | null) {
    if (visibilityActionState) {
      return;
    }

    const student = sourceGroupId
      ? getStudentFromGroups(studentId)
      : unassignedStudents.find((entry) => entry.id === studentId) ?? null;

    if (!student) {
      setLocalAlert({ kind: 'error', message: 'That student could not be found.' });
      return;
    }

    const previousGroups = groups.map((group) => ({
      ...group,
      members: [...group.members]
    }));
    const previousUnassignedStudents = [...unassignedStudents];
    const previousIgnoredStudents = [...ignoredStudents];
    const previousSavedMemberIdsByGroupId = new Map(savedMemberIdsByGroupId);

    const nextGroups = previousGroups.map((group) =>
      group.id === sourceGroupId
        ? {
            ...group,
            members: sortStudentsStable(
              group.members.filter((member) => member.id !== studentId)
            )
          }
        : group
    );
    const nextUnassignedStudents = sourceGroupId
      ? previousUnassignedStudents
      : sortStudentsStable(previousUnassignedStudents.filter((entry) => entry.id !== studentId));
    const nextIgnoredStudents = sortStudentsStable([...previousIgnoredStudents, student]);

    setLocalAlert(null);
    setVisibilityActionState({ action: 'ignore', studentId });
    applyMembershipState(nextGroups, nextUnassignedStudents, nextIgnoredStudents);

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/students/${studentId}/visibility`,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'PATCH',
          body: JSON.stringify({
            action: 'ignore'
          })
        }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not ignore the student.');
      }

      setLocalAlert({ kind: 'notice', message: 'Student ignored.' });
    } catch (ignoreError) {
      setGroups(previousGroups);
      setUnassignedStudents(previousUnassignedStudents);
      setIgnoredStudents(previousIgnoredStudents);
      setSavedMemberIdsByGroupId(previousSavedMemberIdsByGroupId);
      setLocalAlert({
        kind: 'error',
        message:
          ignoreError instanceof Error ? ignoreError.message : 'Could not ignore the student.'
      });
    } finally {
      setVisibilityActionState(null);
    }
  }

  async function handleRestoreStudent(studentId: string) {
    if (visibilityActionState) {
      return;
    }

    const student = ignoredStudents.find((entry) => entry.id === studentId) ?? null;
    if (!student) {
      setLocalAlert({ kind: 'error', message: 'That student could not be found.' });
      return;
    }

    const previousGroups = groups.map((group) => ({
      ...group,
      members: [...group.members]
    }));
    const previousUnassignedStudents = [...unassignedStudents];
    const previousIgnoredStudents = [...ignoredStudents];
    const previousSavedMemberIdsByGroupId = new Map(savedMemberIdsByGroupId);

    const nextIgnoredStudents = sortStudentsStable(
      previousIgnoredStudents.filter((entry) => entry.id !== studentId)
    );
    const nextUnassignedStudents = sortStudentsStable([...previousUnassignedStudents, student]);

    setLocalAlert(null);
    setVisibilityActionState({ action: 'restore', studentId });
    applyMembershipState(previousGroups, nextUnassignedStudents, nextIgnoredStudents);

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/students/${studentId}/visibility`,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'PATCH',
          body: JSON.stringify({
            action: 'restore'
          })
        }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not restore the student.');
      }

      setLocalAlert({ kind: 'notice', message: 'Student restored.' });
    } catch (restoreError) {
      setGroups(previousGroups);
      setUnassignedStudents(previousUnassignedStudents);
      setIgnoredStudents(previousIgnoredStudents);
      setSavedMemberIdsByGroupId(previousSavedMemberIdsByGroupId);
      setLocalAlert({
        kind: 'error',
        message:
          restoreError instanceof Error
            ? restoreError.message
            : 'Could not restore the student.'
      });
    } finally {
      setVisibilityActionState(null);
    }
  }

  function syncGroupsJsonInput(form: HTMLFormElement) {
    const input = form.elements.namedItem('groupsJson');
    if (input instanceof HTMLInputElement) {
      input.value = saveAllPayload(groups);
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>, sessionStudentId: string, sourceGroupId: string | null) {
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({ sessionStudentId, sourceGroupId })
    );
    event.dataTransfer.effectAllowed = 'move';
    setDragState({ sessionStudentId, sourceGroupId });
  }

  function handleDragEnd() {
    setDragState(null);
  }

  function handleGroupDrop(event: DragEvent<HTMLElement>, targetGroupId: string) {
    event.preventDefault();
    const payload = dragState;
    if (!payload) {
      return;
    }

    moveStudent(payload.sessionStudentId, payload.sourceGroupId, targetGroupId);
    setDragState(null);
  }

  function handleUnassignedDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const payload = dragState;
    if (!payload) {
      return;
    }

    moveStudent(payload.sessionStudentId, payload.sourceGroupId, null);
    setDragState(null);
  }

  function isGroupDirty(group: GroupRecord) {
    const snapshot = initialGroupMetaSnapshots.get(group.id);
    if (!snapshot) {
      return true;
    }

    const currentSnapshot = groupSnapshot(group);
    const savedMemberIds = savedMemberIdsByGroupId.get(group.id) ?? [];
    return (
      snapshot.name !== currentSnapshot.name ||
      snapshot.capacity !== currentSnapshot.capacity ||
      !areMemberIdsEqual(savedMemberIds, currentSnapshot.memberIds)
    );
  }

  function updateGroupField(groupId: string, field: 'name' | 'capacity', value: string) {
    setLocalAlert(null);
    setGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              [field]: value
            }
          : group
      )
    );
  }

  const dirtyGroups = groups.filter((group) => isGroupDirty(group));
  const hasDirtyGroups = dirtyGroups.length > 0;
  const highlightErrorSection = alert?.kind === 'error';

  return (
    <section className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="ui-card p-4">
          <p className="ui-section-title">Total students</p>
          <p className="mt-2 text-3xl font-semibold">{totalStudents}</p>
        </div>
        <div className="ui-card p-4">
          <p className="ui-section-title">Assigned</p>
          <p className="mt-2 text-3xl font-semibold">{assignedStudents}</p>
        </div>
        <div className="ui-card p-4">
          <p className="ui-section-title">Unassigned</p>
          <p className="mt-2 text-3xl font-semibold">{unassignedStudents.length}</p>
        </div>
        <div className="ui-card p-4">
          <p className="ui-section-title">Created groups</p>
          <p className="mt-2 text-3xl font-semibold">{groups.length}</p>
        </div>
        <div className="ui-card p-4">
          <p className="ui-section-title">Seats remaining</p>
          <p className="mt-2 text-3xl font-semibold">{totalSeatsRemaining}</p>
        </div>
      </div>

      {alert ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            alert.kind === 'error'
              ? 'border-[color:var(--app-danger)]/20 bg-[color:var(--app-danger)]/10 text-[color:var(--app-danger)]'
              : 'border-[color:var(--app-success)]/20 bg-[color:var(--app-success)]/10 text-[color:var(--app-success)]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{alert.message}</span>
            {alert.kind === 'error' ? (
              <a className="ui-button ui-button-secondary px-3 py-1.5 text-xs" href="#error-targets">
                Go to error(s)
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 ui-panel px-4 py-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{sessionTitle} groups</h2>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            Default group capacity: {defaultGroupCapacity}. Create new groups at any time, drag
            students between the sidebar and groups, then save the changed cards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              isRandomizingStudents ||
              hasInvalidGroupCapacity ||
              visibilityActionState !== null ||
              groups.length === 0 ||
              getVisibleStudents().length === 0
            }
            type="button"
            onClick={handleRandomizeEnrollment}
          >
            {isRandomizingStudents ? 'Randomizing enrollment...' : 'Randomize enrollment'}
          </button>

          <form action={createGroupAction}>
            <input name="sessionId" type="hidden" value={sessionId} />
            <button className="ui-button ui-button-secondary" type="submit">
              Create new group
            </button>
          </form>

          {groups.length > 0 ? (
            <form
              action={saveGroupsAction}
              className="flex items-center gap-2"
              onSubmit={(event) => syncGroupsJsonInput(event.currentTarget)}
            >
              <input name="sessionId" type="hidden" value={sessionId} />
              <input name="groupsJson" type="hidden" value={groupsJson} />
              <button className="ui-button ui-button-primary" type="submit">
                Save all groups
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div
        id="error-targets"
        className={`grid gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] ${
          highlightErrorSection ? 'scroll-mt-24' : ''
        }`}
      >
        <aside className="lg:sticky lg:top-6 lg:h-fit lg:max-h-[calc(100vh-8rem)] lg:overflow-auto">
          <section
            className={`grid gap-4 rounded-2xl border p-5 ${
              alert?.kind === 'error' && !alert.groupId && !alert.studentId
                ? 'border-[color:var(--app-danger)]/25 ring-1 ring-[color:var(--app-danger)]/12'
                : 'border-[color:var(--app-border)]'
            }`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleUnassignedDrop}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Unassigned students</h3>
                <p className="text-sm text-[color:var(--app-fg-muted)]">
                  Drag a student card here to remove them from a group.
                </p>
              </div>

              <button
                aria-expanded={isIgnoredDrawerOpen}
                aria-label="Show ignored students"
                className="relative inline-flex h-9 w-9 items-center justify-center text-[color:var(--app-fg-muted)] transition hover:text-[color:var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={visibilityActionState !== null || isRandomizingStudents}
                title="Show ignored students"
                type="button"
                onClick={() => setIsIgnoredDrawerOpen((current) => !current)}
              >
                <TrashCanIcon className="h-5 w-5" />
                {ignoredStudents.length > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full border border-[color:var(--app-surface)] bg-[color:var(--app-danger)] px-1 text-[10px] font-semibold leading-4 text-white shadow-sm">
                    {ignoredStudents.length}
                  </span>
                ) : null}
              </button>
            </div>

            {unassignedStudents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[color:var(--app-border)] px-4 py-3 text-sm text-[color:var(--app-fg-muted)]">
                All students are assigned to groups.
              </div>
            ) : (
              <div className="grid gap-3">
                {unassignedStudents.map((student) => (
                  <article
                    key={student.id}
                    className={`cursor-grab rounded-xl border px-4 py-3 transition ${
                      alert?.kind === 'error' && alert.studentId === student.id
                        ? 'border-[color:var(--app-danger)]/25 ring-1 ring-[color:var(--app-danger)]/12'
                        : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]'
                    }`}
                    draggable
                    onDragEnd={handleDragEnd}
                    onDragStart={(event) => handleDragStart(event, student.id, null)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">
                          {student.firstName} {student.lastName}
                        </div>
                        <div className="text-sm text-[color:var(--app-fg-muted)]">{student.schoolEmail}</div>
                      </div>
                    </div>

                    {groups.length > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Move ${student.firstName} ${student.lastName} to a group`}
                          className="ui-select min-w-[12rem] flex-1"
                          defaultValue=""
                          disabled={visibilityActionState !== null || isRandomizingStudents}
                          onChange={(event) => handleDestinationChange(student.id, null, event)}
                        >
                          <option disabled hidden value="">
                            Move student to...
                          </option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="ui-button ui-button-secondary px-3 py-2 text-sm"
                          disabled={visibilityActionState !== null || isRandomizingStudents}
                          type="button"
                          onClick={() => handleIgnoreStudent(student.id, null)}
                        >
                          Ignore
                        </button>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[color:var(--app-fg-muted)]">Create groups first to assign.</p>
                    )}
                  </article>
                ))}
              </div>
            )}

            {isIgnoredDrawerOpen ? (
              <div className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">Ignored users</h4>
                    <p className="text-xs text-[color:var(--app-fg-muted)]">
                      Restored users return to the unassigned list.
                    </p>
                  </div>
                </div>

                {ignoredStudents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[color:var(--app-border)] px-4 py-3 text-sm text-[color:var(--app-fg-muted)]">
                    No ignored users.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {ignoredStudents.map((student) => (
                      <article
                        key={student.id}
                        className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">
                              {student.firstName} {student.lastName}
                            </div>
                            <div className="text-sm text-[color:var(--app-fg-muted)]">
                              {student.schoolEmail}
                            </div>
                          </div>

                          <button
                            className="ui-button ui-button-secondary px-3 py-2 text-sm"
                            disabled={visibilityActionState !== null || isRandomizingStudents}
                            type="button"
                            onClick={() => handleRestoreStudent(student.id)}
                          >
                            Restore
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </aside>

        <section className="grid gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Groups</h2>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              Edit group names and capacities, then drag students into the right place.
            </p>
          </div>

          <div className="grid gap-4">
            {groups.map((group) => {
              const memberCount = group.members.length;
              const remainingSeats = Number(group.capacity) - memberCount;
              const dirty = isGroupDirty(group);

              return (
                <article
                  key={group.id}
                  className={`grid gap-4 rounded-2xl border p-5 transition ${
                    alert?.kind === 'error' && alert.groupId === group.id
                      ? 'border-[color:var(--app-danger)]/25 ring-1 ring-[color:var(--app-danger)]/12'
                      : dirty
                        ? 'border-[color:var(--app-warning)]/30 ring-1 ring-[color:var(--app-warning)]/12'
                        : 'border-[color:var(--app-border)] bg-[color:var(--app-surface)]'
                  }`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleGroupDrop(event, group.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{group.name}</h3>
                        <span className={`ui-chip ${dirty ? 'ui-chip-warning' : 'ui-chip-success'}`}>
                          <span aria-hidden>{dirty ? '⚠' : '✓'}</span>
                          {dirty ? 'Unsaved changes' : 'Saved and unchanged'}
                        </span>
                      </div>
                      <p className="text-sm text-[color:var(--app-fg-muted)]">
                        Capacity {group.capacity} · {memberCount} member
                        {memberCount === 1 ? '' : 's'} ·{' '}
                        {remainingSeats >= 0
                          ? `${remainingSeats} seat${remainingSeats === 1 ? '' : 's'} left`
                          : `Over capacity by ${Math.abs(remainingSeats)}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <form
                        action={saveGroupsAction}
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(event) => syncGroupsJsonInput(event.currentTarget)}
                      >
                        <input name="sessionId" type="hidden" value={sessionId} />
                        <input name="groupsJson" type="hidden" value={groupsJson} />
                        <input name="sourceGroupId" type="hidden" value={group.id} />
                        <button className="ui-button ui-button-secondary" type="submit">
                          {dirty ? 'Update and save' : 'Save group'}
                        </button>
                      </form>

                      <form
                        action={deleteGroupAction}
                        onSubmit={(event) => {
                          if (
                            !window.confirm(
                              `Delete ${group.name}? This removes the group and its memberships.`
                            )
                          ) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input name="sessionId" type="hidden" value={sessionId} />
                        <input name="groupId" type="hidden" value={group.id} />
                        <button className="ui-button ui-button-danger" type="submit">
                          Delete group
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl bg-[color:var(--app-surface-muted)] p-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <label className="grid gap-1 text-sm font-medium">
                      Group name
                      <input
                        className="ui-input"
                        name="name"
                        onChange={(event) => updateGroupField(group.id, 'name', event.target.value)}
                        type="text"
                        value={group.name}
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      Capacity
                      <input
                        className="ui-input"
                        min="1"
                        name="capacity"
                        onChange={(event) =>
                          updateGroupField(group.id, 'capacity', event.target.value)
                        }
                        type="number"
                        value={group.capacity}
                      />
                    </label>
                  </div>

                  <div className="grid gap-3">
                    <div className="text-sm font-medium">Members</div>

                    {group.members.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[color:var(--app-border)] px-4 py-3 text-sm text-[color:var(--app-fg-muted)]">
                        No students in this group yet.
                      </div>
                    ) : (
                      <div className="overflow-hidden border border-[color:var(--app-border)] bg-[color:var(--app-surface)]">
                        {group.members.map((member) => (
                          <div
                            key={member.id}
                            className={`grid cursor-grab gap-3 border-b border-[color:var(--app-border)] px-3 py-2 transition last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                              alert?.kind === 'error' && alert.studentId === member.id
                                ? 'bg-[color:var(--app-danger)]/5 ring-1 ring-[color:var(--app-danger)]/12'
                                : 'bg-[color:var(--app-surface)]'
                            }`}
                            draggable
                            onDragEnd={handleDragEnd}
                            onDragStart={(event) => handleDragStart(event, member.id, group.id)}
                          >
                            <div className="min-w-0 self-center">
                              <div className="truncate text-sm font-medium">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="truncate text-xs text-[color:var(--app-fg-muted)]">
                                {member.schoolEmail}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 self-center sm:justify-end">
                              <select
                                aria-label={`Move ${member.firstName} ${member.lastName} to a group`}
                                className="ui-select min-w-[12rem]"
                                defaultValue=""
                                disabled={visibilityActionState !== null || isRandomizingStudents}
                                onChange={(event) =>
                                  handleDestinationChange(member.id, group.id, event)
                                }
                              >
                                <option disabled hidden value="">
                                  Move student to...
                                </option>
                                {groups
                                  .filter((destinationGroup) => destinationGroup.id !== group.id)
                                  .map((destinationGroup) => (
                                    <option key={destinationGroup.id} value={destinationGroup.id}>
                                      {destinationGroup.name}
                                    </option>
                                  ))}
                              </select>

                              <button
                                className="ui-button ui-button-danger"
                                type="button"
                                onClick={() => handleRemoveClick(member.id, group.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {groups.length === 0 ? (
            <div className="ui-panel p-6 text-sm text-[color:var(--app-fg-muted)]">
              Create default groups to begin managing memberships.
            </div>
          ) : null}

          {hasDirtyGroups ? (
            <div className="ui-chip ui-chip-warning px-4 py-3 text-sm">
              {dirtyGroups.length} group{dirtyGroups.length === 1 ? '' : 's'} have unsaved changes.
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
