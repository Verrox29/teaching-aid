'use client';

import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';

import {
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
  groupCount: number;
  groups: InitialGroupRecord[];
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

export function SessionGroupsBoard({
  defaultGroupCapacity,
  error,
  errorGroupId,
  errorStudentId,
  groupCount,
  groups: initialGroups,
  notice,
  sessionId,
  sessionTitle,
  unassignedStudents: initialUnassignedStudents
}: SessionGroupsBoardProps) {
  const [groups, setGroups] = useState<GroupRecord[]>(() => copyGroups(initialGroups));
  const [unassignedStudents, setUnassignedStudents] = useState<StudentRecord[]>(() =>
    sortStudentsStable(initialUnassignedStudents)
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [localAlert, setLocalAlert] = useState<AlertState | null>(null);

  const initialSnapshots = useMemo(
    () =>
      new Map(
        initialGroups.map((group) => [
          group.id,
          groupSnapshot({
            id: group.id,
            name: group.name,
            capacity: String(group.capacity),
            members: group.members
          })
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

  function getStudentFromGroups(sessionStudentId: string) {
    for (const group of groups) {
      const member = group.members.find((student) => student.id === sessionStudentId);
      if (member) {
        return member;
      }
    }

    return null;
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

  function handleAssignClick(
    event: React.MouseEvent<HTMLButtonElement>,
    studentId: string,
    sourceGroupId: string | null
  ) {
    const form = event.currentTarget.form;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const groupId = String(formData.get('groupId') ?? '');

    if (!groupId) {
      setLocalAlert({
        kind: 'error',
        message: 'Pick a destination group.',
        studentId
      });
      return;
    }

    moveStudent(studentId, sourceGroupId, groupId);
  }

  function handleMoveClick(
    event: React.MouseEvent<HTMLButtonElement>,
    studentId: string,
    sourceGroupId: string
  ) {
    const form = event.currentTarget.form;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const groupId = String(formData.get('groupId') ?? '');

    if (!groupId) {
      setLocalAlert({
        kind: 'error',
        message: 'Pick a destination group.',
        studentId
      });
      return;
    }

    moveStudent(studentId, sourceGroupId, groupId);
  }

  function handleRemoveClick(studentId: string, sourceGroupId: string) {
    moveStudent(studentId, sourceGroupId, null);
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
    const snapshot = initialSnapshots.get(group.id);
    if (!snapshot) {
      return true;
    }

    const currentSnapshot = groupSnapshot(group);
    return (
      snapshot.name !== currentSnapshot.name ||
      snapshot.capacity !== currentSnapshot.capacity ||
      !areMemberIdsEqual(snapshot.memberIds, currentSnapshot.memberIds)
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
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total students</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalStudents}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Assigned</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{assignedStudents}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Unassigned
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {unassignedStudents.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total groups</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{groupCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Seats remaining
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalSeatsRemaining}</p>
        </div>
      </div>

      {alert ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            alert.kind === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{alert.message}</span>
            {alert.kind === 'error' ? (
              <a
                className="inline-flex items-center rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                href="#error-targets"
              >
                Go to error(s)
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">{sessionTitle} groups</h2>
          <p className="text-sm text-slate-600">
            Default group capacity: {defaultGroupCapacity}. Drag students between the sidebar and
            groups, then save the changed cards.
          </p>
        </div>

      {groups.length > 0 ? (
          <form
            action={saveGroupsAction}
            className="flex items-center gap-2"
            onSubmit={(event) => syncGroupsJsonInput(event.currentTarget)}
          >
            <input name="sessionId" type="hidden" value={sessionId} />
            <input name="groupsJson" type="hidden" value={groupsJson} />
            <button
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              type="submit"
            >
              Save all groups
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-500">Create default groups to unlock saving.</p>
        )}
      </div>

      <div
        id="error-targets"
        className={`grid gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] ${
          highlightErrorSection ? 'scroll-mt-24' : ''
        }`}
      >
        <aside className="lg:sticky lg:top-6 lg:h-fit lg:max-h-[calc(100vh-8rem)] lg:overflow-auto">
          <section
            className={`grid gap-4 rounded-xl border bg-white p-5 shadow-sm ${
              alert?.kind === 'error' && !alert.groupId && !alert.studentId
                ? 'border-rose-300 ring-1 ring-rose-100'
                : 'border-slate-200'
            }`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleUnassignedDrop}
          >
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">Unassigned students</h3>
              <p className="text-sm text-slate-600">
                Drag a student card here to remove them from a group.
              </p>
            </div>

            {unassignedStudents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                All students are assigned to groups.
              </div>
            ) : (
              <div className="grid gap-3">
                {unassignedStudents.map((student) => (
                  <article
                    key={student.id}
                    className={`cursor-grab rounded-lg border bg-slate-50 px-4 py-3 transition ${
                      alert?.kind === 'error' && alert.studentId === student.id
                        ? 'border-rose-300 ring-1 ring-rose-100'
                        : 'border-slate-200'
                    }`}
                    draggable
                    onDragEnd={handleDragEnd}
                    onDragStart={(event) => handleDragStart(event, student.id, null)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {student.firstName} {student.lastName}
                        </div>
                        <div className="text-sm text-slate-500">{student.schoolEmail}</div>
                      </div>
                    </div>

                    {groups.length > 0 ? (
                      <form className="mt-3 flex flex-wrap items-center gap-2">
                        <input name="sessionId" type="hidden" value={sessionId} />
                        <input name="sessionStudentId" type="hidden" value={student.id} />
                        <select
                          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          defaultValue={groups[0]?.id}
                          name="groupId"
                        >
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                          type="button"
                          onClick={(event) => handleAssignClick(event, student.id, null)}
                        >
                          Assign
                        </button>
                      </form>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">Create groups first to assign.</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className="grid gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-900">Groups</h2>
            <p className="text-sm text-slate-600">
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
                  className={`grid gap-4 rounded-xl border bg-white p-5 shadow-sm transition ${
                    alert?.kind === 'error' && alert.groupId === group.id
                      ? 'border-rose-300 ring-1 ring-rose-100'
                      : dirty
                        ? 'border-amber-200 ring-1 ring-amber-100'
                      : 'border-slate-200'
                  }`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleGroupDrop(event, group.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">{group.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                            dirty
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          <span aria-hidden>{dirty ? '⚠' : '✓'}</span>
                          {dirty ? 'Unsaved changes' : 'Saved and unchanged'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        Capacity {group.capacity} · {memberCount} member
                        {memberCount === 1 ? '' : 's'} ·{' '}
                        {remainingSeats >= 0
                          ? `${remainingSeats} seat${remainingSeats === 1 ? '' : 's'} left`
                          : `Over capacity by ${Math.abs(remainingSeats)}`}
                      </p>
                    </div>

                    <form
                      action={saveGroupsAction}
                      className="flex items-center gap-2"
                      onSubmit={(event) => syncGroupsJsonInput(event.currentTarget)}
                    >
                      <input name="sessionId" type="hidden" value={sessionId} />
                      <input name="groupsJson" type="hidden" value={groupsJson} />
                      <input name="sourceGroupId" type="hidden" value={group.id} />
                      <button
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        type="submit"
                      >
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
                      <button
                        className="inline-flex items-center justify-center rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                        type="submit"
                      >
                        Delete group
                      </button>
                    </form>
                  </div>

                  <div className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      Group name
                      <input
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        name="name"
                        onChange={(event) => updateGroupField(group.id, 'name', event.target.value)}
                        type="text"
                        value={group.name}
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      Capacity
                      <input
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
                    <div className="text-sm font-medium text-slate-900">Members</div>

                    {group.members.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                        No students in this group yet.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {group.members.map((member) => (
                          <article
                            key={member.id}
                    className={`cursor-grab rounded-lg border px-4 py-3 transition ${
                      alert?.kind === 'error' && alert.studentId === member.id
                        ? 'border-rose-300 ring-1 ring-rose-100'
                        : 'border-slate-200'
                    }`}
                    draggable
                    onDragEnd={handleDragEnd}
                    onDragStart={(event) => handleDragStart(event, member.id, group.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                                <div className="text-sm font-medium text-slate-900">
                                  {member.firstName} {member.lastName}
                                </div>
                                <div className="text-sm text-slate-500">{member.schoolEmail}</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <form className="flex flex-wrap items-center gap-2">
                                <input name="sessionId" type="hidden" value={sessionId} />
                                <input
                                  name="sessionStudentId"
                                  type="hidden"
                                  value={member.id}
                                />
                                <select
                                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                  defaultValue={group.id}
                                  name="groupId"
                                >
                                  {groups.map((destinationGroup) => (
                                    <option key={destinationGroup.id} value={destinationGroup.id}>
                                      {destinationGroup.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                  type="button"
                                  onClick={(event) => handleMoveClick(event, member.id, group.id)}
                                >
                                  Move
                                </button>
                              </form>

                              <button
                                className="rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                                type="button"
                                onClick={() => handleRemoveClick(member.id, group.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {groups.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Create default groups to begin managing memberships.
            </div>
          ) : null}

          {hasDirtyGroups ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {dirtyGroups.length} group{dirtyGroups.length === 1 ? '' : 's'} have unsaved changes.
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
