'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

import {
  createGroupAction,
  deleteGroupAction,
  lockGroupSelectionAction,
  saveGroupsAction,
  unlockGroupSelectionAction
} from '@/app/sessions/[sessionId]/groups/actions';
import { getUiText } from '@/lib/ui-language';
import { useUiLanguage } from '@/components/ui-language-toggle';

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
  groupSelectionLocked: boolean;
  notice?: string;
  publicPageHref: string;
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

async function renameGroupOnServer(sessionId: string, groupId: string, name: string) {
  const response = await fetch(`/api/sessions/${sessionId}/groups/${groupId}/rename`, {
    body: JSON.stringify({
      sessionId,
      groupId,
      name
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

  return typeof payload.name === 'string' ? payload.name : name;
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

function PublicPageQrModal({
  closeLabel,
  onClose,
  open,
  publicPageLabel,
  publicPageHref,
  title,
  url
}: {
  closeLabel: string;
  publicPageHref: string;
  publicPageLabel: string;
  onClose: () => void;
  open: boolean;
  title: string;
  url: string;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[color:rgba(17,12,25,0.38)] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          aria-modal="true"
          className="w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="ui-section-title">{title}</p>
              <h2 className="text-xl font-semibold">{title}</h2>
            </div>
            <button
              className="ui-button ui-button-secondary px-3 py-2 text-sm"
              onClick={onClose}
              type="button"
            >
              {closeLabel}
            </button>
          </div>

          <div className="mt-4 grid justify-items-center gap-4 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG bgColor="#ffffff" fgColor="#111827" includeMargin size={220} value={url} />
            </div>
            <Link className="ui-button ui-button-secondary px-3 py-2 text-sm" href={publicPageHref}>
              {publicPageLabel}
            </Link>
            <p className="break-all text-center text-xs text-[color:var(--app-fg-muted)]">{url}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m18 15-6-6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ChevronDownSmallIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m6 10 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
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
  groupSelectionLocked,
  notice,
  publicPageHref,
  sessionId,
  sessionTitle,
  unassignedStudents: initialUnassignedStudents
}: SessionGroupsBoardProps) {
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).sessionGroups;
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
  const [publicQrOpen, setPublicQrOpen] = useState(false);
  const [publicPageUrl, setPublicPageUrl] = useState('');
  const [localAlert, setLocalAlert] = useState<AlertState | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const editingGroupNameInputRef = useRef<HTMLInputElement | null>(null);
  const renameBlurActionRef = useRef<'save' | 'cancel' | null>(null);

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

  const totalStudents =
    groups.reduce((count, group) => count + group.members.length, 0) + unassignedStudents.length;
  const assignedStudents = groups.reduce((count, group) => count + group.members.length, 0);
  const totalSeatsRemaining = groups.reduce(
    (count, group) => count + Math.max(0, Number(group.capacity) - group.members.length),
    0
  );
  const hasInvalidGroupCapacity = groups.some(
    (group) => !Number.isFinite(Number(group.capacity)) || Number(group.capacity) < 1
  );
  const topActionButtonClass = 'ui-button ui-button-secondary px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm';
  const topPrimaryActionButtonClass =
    'ui-button ui-button-primary px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm';

  useEffect(() => {
    if (!editingGroupId) {
      return;
    }

    editingGroupNameInputRef.current?.focus();
    editingGroupNameInputRef.current?.select();
  }, [editingGroupId]);

  useEffect(() => {
    setPublicPageUrl(new URL(publicPageHref, window.location.origin).toString());
  }, [publicPageHref]);

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

  function startEditingGroup(groupId: string, currentName: string) {
    renameBlurActionRef.current = null;
    setEditingGroupId(groupId);
    setEditingGroupName(currentName);
  }

  function cancelEditingGroup() {
    renameBlurActionRef.current = null;
    setEditingGroupId(null);
    setEditingGroupName('');
  }

  async function finishEditingGroup(groupId: string, nextName: string) {
    const trimmedName = nextName.trim();
    const currentGroup = groups.find((group) => group.id === groupId);

    if (!currentGroup || !trimmedName || trimmedName === currentGroup.name.trim()) {
      cancelEditingGroup();
      return;
    }

    setLocalAlert(null);

    try {
      const renamedGroupName = await renameGroupOnServer(sessionId, groupId, trimmedName);
      setGroups((currentGroups) =>
        currentGroups.map((group) =>
          group.id === groupId ? { ...group, name: renamedGroupName } : group
        )
      );
      cancelEditingGroup();
      setLocalAlert({ kind: 'notice', message: 'Group renamed.' });
    } catch (error) {
      setEditingGroupName(currentGroup?.name ?? nextName);
      renameBlurActionRef.current = null;
      setLocalAlert({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not rename the group.'
      });
    }
  }

  const dirtyGroups = groups.filter((group) => isGroupDirty(group));
  const hasDirtyGroups = dirtyGroups.length > 0;
  const highlightErrorSection = alert?.kind === 'error';
  const isFrench = uiLanguage === 'fr';
  const closeLabel = isFrench ? 'Fermer' : 'Close';

  return (
    <section className="grid gap-6">
      <section className="ui-panel grid gap-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="space-y-1">
              <p className="ui-section-title flex flex-wrap items-center gap-2">
                <span>{sessionTitle}</span>
                <span aria-hidden="true" className="text-[color:var(--app-fg-muted)]">
                  •
                </span>
                <span>{t.groupsTitle}</span>
              </p>
              <p className="max-w-3xl text-sm text-[color:var(--app-fg-muted)]">
                {isFrench
                  ? `Capacité par défaut des groupes : ${defaultGroupCapacity}. Créez de nouveaux groupes à tout moment, glissez les étudiants entre la barre latérale et les groupes, puis enregistrez les cartes modifiées.`
                  : `Default group capacity: ${defaultGroupCapacity}. Create new groups at any time, drag students between the sidebar and groups, then save the changed cards.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                aria-expanded={publicQrOpen}
                aria-haspopup="dialog"
                className={topActionButtonClass}
                disabled={!publicPageUrl}
                onClick={() => setPublicQrOpen(true)}
                type="button"
              >
                {t.publicPage}
              </button>

              {groupSelectionLocked ? (
                <form action={unlockGroupSelectionAction}>
                  <input name="sessionId" type="hidden" value={sessionId} />
                  <button className={topActionButtonClass} type="submit">
                    {isFrench ? 'Déverrouiller les groupes' : 'Unlock group selection'}
                  </button>
                </form>
              ) : (
                <form action={lockGroupSelectionAction}>
                  <input name="sessionId" type="hidden" value={sessionId} />
                  <button className={topActionButtonClass} type="submit">
                    {isFrench ? 'Verrouiller les groupes' : 'Lock group selection'}
                  </button>
                </form>
              )}

              <button
                className={topActionButtonClass}
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
                {isRandomizingStudents
                  ? isFrench
                    ? 'Randomisation des inscriptions...'
                    : 'Randomizing enrollment...'
                  : isFrench
                    ? 'Randomiser les inscriptions'
                    : 'Randomize enrollment'}
              </button>

              <form action={createGroupAction}>
                <input name="sessionId" type="hidden" value={sessionId} />
                <button className={topActionButtonClass} type="submit">
                  {isFrench ? 'Créer un nouveau groupe' : 'Create new group'}
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
                  <button className={topPrimaryActionButtonClass} type="submit">
                    {isFrench ? 'Enregistrer tous les groupes' : 'Save all groups'}
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 lg:w-[320px] lg:min-w-[320px]">
            <div className="rounded-lg border border-[color:var(--app-border)] px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--app-fg-muted)]">
                {isFrench ? 'Étudiants totaux' : 'Total students'}
              </p>
              <p className="mt-1 text-base font-semibold leading-none">{totalStudents}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--app-border)] px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--app-fg-muted)]">
                {isFrench ? 'Attribués' : 'Assigned'}
              </p>
              <p className="mt-1 text-base font-semibold leading-none">{assignedStudents}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--app-border)] px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--app-fg-muted)]">
                {isFrench ? 'Non attribués' : 'Unassigned'}
              </p>
              <p className="mt-1 text-base font-semibold leading-none">{unassignedStudents.length}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--app-border)] px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--app-fg-muted)]">
                {isFrench ? 'Groupes créés' : 'Created groups'}
              </p>
              <p className="mt-1 text-base font-semibold leading-none">{groups.length}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--app-border)] px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--app-fg-muted)]">
                {isFrench ? 'Places restantes' : 'Seats remaining'}
              </p>
              <p className="mt-1 text-base font-semibold leading-none">{totalSeatsRemaining}</p>
            </div>
          </div>
        </div>
      </section>

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
                {isFrench ? 'Aller aux erreurs' : 'Go to error(s)'}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

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
                <h3 className="text-lg font-semibold">{t.unassignedStudents}</h3>
                <p className="text-sm text-[color:var(--app-fg-muted)]">
                  {t.dragToRemove}
                </p>
              </div>

              <button
                aria-expanded={isIgnoredDrawerOpen}
                aria-label={t.showIgnoredStudents}
                className="relative inline-flex h-9 w-9 items-center justify-center text-[color:var(--app-fg-muted)] transition hover:text-[color:var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={visibilityActionState !== null || isRandomizingStudents}
                title={t.showIgnoredStudents}
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
                {t.allStudentsAssigned}
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
                            {t.moveStudentTo}
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
                          {t.ignore}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[color:var(--app-fg-muted)]">{t.createGroupsFirstToAssign}</p>
                    )}
                  </article>
                ))}
              </div>
            )}

            {isIgnoredDrawerOpen ? (
              <div className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">{t.ignoredUsers}</h4>
                    <p className="text-xs text-[color:var(--app-fg-muted)]">
                      {t.restoredUsersReturn}
                    </p>
                  </div>
                </div>

                {ignoredStudents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[color:var(--app-border)] px-4 py-3 text-sm text-[color:var(--app-fg-muted)]">
                    {t.noIgnoredUsers}
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
                            {isFrench ? 'Restaurer' : 'Restore'}
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
            <h2 className="text-xl font-semibold">{t.groupsTitle}</h2>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              {isFrench
                ? 'Modifiez les noms et capacités des groupes, puis glissez les étudiants au bon endroit.'
                : 'Edit group names and capacities, then drag students into the right place.'}
            </p>
          </div>

          <div className="grid gap-4">
            {groups.map((group) => {
              const memberCount = group.members.length;
              const remainingSeats = Number(group.capacity) - memberCount;
              const dirty = isGroupDirty(group);
              const capacity = Math.max(1, Number(group.capacity) || 1);

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
                  <div className="flex flex-nowrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-nowrap items-center gap-2">
                      <div className="group relative shrink-0">
                        <button
                          aria-label={isFrench ? `Renommer ${group.name}` : `Rename ${group.name}`}
                          className={`relative flex items-center gap-2 rounded-full border px-2 py-1 pr-7 text-sm font-semibold transition ${
                            dirty
                              ? 'border-[color:var(--app-warning)]/30 bg-[color:var(--app-warning)]/8 text-[color:var(--app-fg)]'
                              : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-fg)]'
                          } ${editingGroupId === group.id ? 'pointer-events-none opacity-0' : ''}`}
                          type="button"
                          onClick={() => startEditingGroup(group.id, group.name)}
                          title={isFrench ? 'Renommer le groupe' : 'Rename group'}
                        >
                          <span className="truncate">{group.name}</span>
                        </button>
                        {editingGroupId === group.id ? (
                          <input
                            ref={editingGroupNameInputRef}
                            aria-label={isFrench ? `Renommer ${group.name}` : `Rename ${group.name}`}
                            className={`absolute inset-0 z-30 w-full rounded-full border px-2 py-1 pr-7 text-sm font-semibold outline-none ${
                              dirty
                                ? 'border-[color:var(--app-warning)]/30 bg-[color:var(--app-warning)]/8 text-[color:var(--app-fg)]'
                                : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-fg)]'
                            }`}
                            autoComplete="off"
                            onBlur={(event) => {
                              if (renameBlurActionRef.current === 'cancel') {
                                cancelEditingGroup();
                                return;
                              }

                              renameBlurActionRef.current = null;
                              void finishEditingGroup(group.id, event.currentTarget.value);
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
                          aria-label={isFrench ? `Renommer ${group.name}` : `Rename ${group.name}`}
                          className="absolute right-1 top-1/2 z-30 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--app-fg-muted)] opacity-70 transition hover:text-[color:var(--app-fg)] hover:opacity-100"
                          title={isFrench ? 'Renommer le groupe' : 'Rename group'}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditingGroup(group.id, group.name);
                          }}
                        >
                          <PencilIcon className="h-3 w-3" />
                        </button>
                      </div>

                      <span
                        className={`ui-chip px-2 py-0.5 text-[11px] ${dirty ? 'ui-chip-warning' : 'ui-chip-success'}`}
                      >
                        <span aria-hidden>{dirty ? '⚠' : '✓'}</span>
                        {dirty
                          ? isFrench
                            ? 'Modifications non enregistrées'
                            : 'Unsaved changes'
                          : isFrench
                            ? 'Enregistré et inchangé'
                            : 'Saved and unchanged'}
                      </span>

                      <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-1.5 py-0.5 text-[color:var(--app-fg-muted)]">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                          {t.cap}
                        </span>
                        <div className="inline-flex items-center gap-0.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-1 py-0.5">
                          <button
                            aria-label={isFrench ? `Réduire la capacité de ${group.name}` : `Decrease capacity for ${group.name}`}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[color:var(--app-fg-muted)] transition hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={capacity <= 1}
                            type="button"
                            onClick={() => updateGroupField(group.id, 'capacity', String(capacity - 1))}
                          >
                            <ChevronDownSmallIcon className="h-2.5 w-2.5" />
                          </button>
                          <span className="min-w-4 text-center text-xs font-semibold leading-none text-[color:var(--app-fg)]">
                            {capacity}
                          </span>
                          <button
                            aria-label={isFrench ? `Augmenter la capacité de ${group.name}` : `Increase capacity for ${group.name}`}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[color:var(--app-fg-muted)] transition hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-fg)]"
                            type="button"
                            onClick={() => updateGroupField(group.id, 'capacity', String(capacity + 1))}
                          >
                            <ChevronUpIcon className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-nowrap items-center gap-2">
                      <form
                        action={saveGroupsAction}
                        className="flex items-center gap-2"
                        onSubmit={(event) => syncGroupsJsonInput(event.currentTarget)}
                      >
                        <input name="sessionId" type="hidden" value={sessionId} />
                        <input name="groupsJson" type="hidden" value={groupsJson} />
                        <input name="sourceGroupId" type="hidden" value={group.id} />
                        <button className="ui-button ui-button-secondary px-3 py-1.5 text-sm" type="submit">
                          {dirty ? t.updateAndSave : t.saveGroup}
                        </button>
                      </form>

                      <form
                        action={deleteGroupAction}
                        onSubmit={(event) => {
                          if (
                            !window.confirm(
                              isFrench
                                ? `Supprimer ${group.name} ? Cela supprimera le groupe et ses membres.`
                                : `Delete ${group.name}? This removes the group and its memberships.`
                            )
                          ) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input name="sessionId" type="hidden" value={sessionId} />
                        <input name="groupId" type="hidden" value={group.id} />
                        <button className="ui-button ui-button-danger px-3 py-1.5 text-sm" type="submit">
                          {t.deleteGroup}
                        </button>
                      </form>
                    </div>
                  </div>

                  <p className="text-sm text-[color:var(--app-fg-muted)]">
                    {isFrench
                      ? `${memberCount} étudiant${memberCount === 1 ? '' : 's'} · ${
                          remainingSeats >= 0
                            ? `${remainingSeats} place${remainingSeats === 1 ? '' : 's'} restante${remainingSeats === 1 ? '' : 's'}`
                            : `Dépassé de ${Math.abs(remainingSeats)}`
                        }`
                      : `${memberCount} member${memberCount === 1 ? '' : 's'} · ${
                          remainingSeats >= 0
                            ? `${remainingSeats} seat${remainingSeats === 1 ? '' : 's'} left`
                            : `Over capacity by ${Math.abs(remainingSeats)}`
                        }`}
                  </p>

                  <div className="grid gap-3">
                    <div className="text-sm font-medium">{t.members}</div>

                    {group.members.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[color:var(--app-border)] px-4 py-3 text-sm text-[color:var(--app-fg-muted)]">
                        {t.noStudentsInGroup}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
                        {group.members.map((member) => (
                          <div
                            key={member.id}
                            className={`grid cursor-grab gap-2 border-b border-[color:var(--app-border)] px-3 py-2 transition last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                              alert?.kind === 'error' && alert.studentId === member.id
                                ? 'bg-[color:var(--app-danger)]/5 ring-1 ring-[color:var(--app-danger)]/12'
                                : 'bg-transparent'
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

                            <div className="flex flex-nowrap items-center gap-2 self-center sm:justify-end">
                              <select
                                aria-label={isFrench ? `Déplacer ${member.firstName} ${member.lastName} vers un groupe` : `Move ${member.firstName} ${member.lastName} to a group`}
                                className="ui-select w-[10.5rem] shrink-0"
                                defaultValue=""
                                disabled={visibilityActionState !== null || isRandomizingStudents}
                                onChange={(event) =>
                                  handleDestinationChange(member.id, group.id, event)
                                }
                              >
                                <option disabled hidden value="">
                                  {t.moveStudentTo}
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
                                className="ui-button ui-button-danger shrink-0"
                                type="button"
                                onClick={() => handleRemoveClick(member.id, group.id)}
                              >
                                {t.remove}
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
              {t.createDefaultGroupsToBeginManagingMemberships}
            </div>
          ) : null}

          {hasDirtyGroups ? (
            <div className="ui-chip ui-chip-warning px-4 py-3 text-sm">
              {isFrench
                ? `${dirtyGroups.length} groupe${dirtyGroups.length === 1 ? '' : 's'} ${t.haveUnsavedChanges}`
                : `${dirtyGroups.length} group${dirtyGroups.length === 1 ? '' : 's'} ${t.haveUnsavedChanges}`}
            </div>
          ) : null}
        </section>
      </div>

      <PublicPageQrModal
        closeLabel={closeLabel}
        publicPageHref={publicPageHref}
        publicPageLabel={t.publicPage}
        onClose={() => setPublicQrOpen(false)}
        open={publicQrOpen}
        title={t.scanToEnrolToAGroup}
        url={publicPageUrl}
      />
    </section>
  );
}
