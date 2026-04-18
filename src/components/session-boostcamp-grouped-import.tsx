"use client";

import { useActionState, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';

import { importBoostcampGroupedStudentsAction } from '@/app/sessions/[sessionId]/students/actions';
import {
  parseBoostcampGroupedFile,
  type BoostcampGroupedMetadataSuggestions,
  type BoostcampGroupedParseDebug,
  type BoostcampGroupedNormalizationPreviewRow,
  type BoostcampGroupedImportPreviewRow
} from '@/app/sessions/[sessionId]/students/import-utils';

type SessionBoostcampGroupedImportProps = {
  onImportApplied?: () => void;
  onMetadataSuggestionsChange?: (suggestions: BoostcampGroupedMetadataSuggestions) => void;
  sessionId: string;
};

type GroupedImportActionState = {
  message?: string;
  success?: boolean;
};

type UnclassifiedDecisionMode = '' | 'ignore' | 'unassigned' | 'manual';

type UnclassifiedDecision = {
  mode: UnclassifiedDecisionMode;
  className: string;
  groupName: string;
};

type FinalStudentRecord = {
  firstName: string;
  lastName: string;
  schoolEmail: string;
};

type FinalGroupRecord = {
  name: string;
  memberEmails: string[];
};

const initialActionState: GroupedImportActionState = {};

function sortStrings(values: string[]) {
  return [...values].sort((left, right) =>
    left.localeCompare(right, 'en', { sensitivity: 'base' })
  );
}

export function SessionBoostcampGroupedImport({
  onImportApplied,
  onMetadataSuggestionsChange,
  sessionId
}: SessionBoostcampGroupedImportProps) {
  const [rows, setRows] = useState<BoostcampGroupedImportPreviewRow[]>([]);
  const [normalizationPreview, setNormalizationPreview] = useState<
    BoostcampGroupedNormalizationPreviewRow[]
  >([]);
  const [fileName, setFileName] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<BoostcampGroupedParseDebug | null>(null);
  const [parseMessage, setParseMessage] = useState<string>();
  const [parseError, setParseError] = useState<string>();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedClassNames, setSelectedClassNames] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<string, UnclassifiedDecision>>({});
  const [actionState, formAction, isPending] = useActionState(
    importBoostcampGroupedStudentsAction,
    initialActionState
  );

  const detectedClasses = useMemo(() => {
    return sortStrings(
      [...new Set(rows.map((row) => row.values.detectedClassName).filter(Boolean) as string[])]
    );
  }, [rows]);

  const unresolvedRows = useMemo(
    () => rows.filter((row) => row.needsResolution),
    [rows]
  );

  const invalidRows = useMemo(() => rows.filter((row) => !row.isValid), [rows]);

  const hasResolvedAllUnclassifiedRows = useMemo(
    () =>
      unresolvedRows.every((row) => {
        const decision = decisions[row.id];
        return Boolean(decision?.mode);
      }),
    [decisions, unresolvedRows]
  );

  const resolvedRows = useMemo(() => {
    return rows
      .map((row) => {
        if (row.needsResolution) {
          const decision = decisions[row.id];
          if (!decision || !decision.mode) {
            return null;
          }

          if (decision.mode === 'ignore') {
            return null;
          }

          if (decision.mode === 'unassigned') {
            return {
              row,
              include: true,
              className: null,
              groupName: null
            };
          }

          return {
            row,
            include: true,
            className: decision.className.trim() || null,
            groupName: decision.groupName.trim() || null
          };
        }

        return {
          row,
          include: Boolean(row.values.detectedClassName),
          className: row.values.detectedClassName?.trim() || null,
          groupName: row.values.detectedGroupName?.trim() || null
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [decisions, rows]);

  const selectedRows = useMemo(() => {
    return resolvedRows.filter((entry) => {
      if (!entry.className) {
        return entry.include;
      }

      return selectedClassNames.includes(entry.className);
    });
  }, [resolvedRows, selectedClassNames]);

  const selectedStudents = useMemo<FinalStudentRecord[]>(() => {
    const nextStudents = selectedRows.map((entry) => ({
      firstName: entry.row.values.firstName.trim(),
      lastName: entry.row.values.lastName.trim(),
      schoolEmail: entry.row.values.schoolEmail.trim().toLowerCase()
    }));

    return nextStudents.filter((student, index) => {
      const email = student.schoolEmail;
      return (
        nextStudents.findIndex((candidate) => candidate.schoolEmail === email) === index &&
        Boolean(email)
      );
    });
  }, [selectedRows]);

  const groupedAssignments = useMemo(() => {
    const byGroup = new Map<string, Set<string>>();
    const unassignedStudents: FinalStudentRecord[] = [];

    for (const entry of selectedRows) {
      const student = {
        firstName: entry.row.values.firstName.trim(),
        lastName: entry.row.values.lastName.trim(),
        schoolEmail: entry.row.values.schoolEmail.trim().toLowerCase()
      };

      if (!student.schoolEmail) {
        continue;
      }

      if (!entry.groupName) {
        unassignedStudents.push(student);
        continue;
      }

      const groupName = `${entry.className?.trim() ?? ''} - ${entry.groupName.trim()}`.trim();
      const currentEmails = byGroup.get(groupName) ?? new Set<string>();
      currentEmails.add(student.schoolEmail);
      byGroup.set(groupName, currentEmails);
    }

    const groups: FinalGroupRecord[] = [...byGroup.entries()]
      .map(([name, memberEmails]) => ({
        name,
        memberEmails: sortStrings([...memberEmails])
      }))
      .filter((group) => group.memberEmails.length > 0)
      .sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }));

    const uniqueUnassigned: FinalStudentRecord[] = [];
    const seenEmails = new Set<string>();
    for (const student of unassignedStudents) {
      if (seenEmails.has(student.schoolEmail)) {
        continue;
      }

      seenEmails.add(student.schoolEmail);
      uniqueUnassigned.push(student);
    }

    return {
      groups,
      unassignedStudents: uniqueUnassigned
    };
  }, [selectedRows]);

  const payloadJson = useMemo(() => {
    const payload = {
      students: selectedStudents,
      groups: groupedAssignments.groups
    };

    if (selectedStudents.length === 0) {
      return '';
    }

    return JSON.stringify(payload);
  }, [groupedAssignments.groups, selectedStudents]);

  const canContinue =
    rows.length > 0 &&
    invalidRows.length === 0 &&
    unresolvedRows.length > 0
      ? hasResolvedAllUnclassifiedRows && selectedClassNames.length > 0 && selectedStudents.length > 0
      : selectedClassNames.length > 0 && selectedStudents.length > 0;

  async function handleFile(file: File) {
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setRows([]);
      setNormalizationPreview([]);
      setSelectedClassNames([]);
      setDecisions({});
      setParseMessage(undefined);
      setParseError('Please upload a CSV file exported from Boostcamp.');
      setDebugInfo({
        detectedDelimiter: 'unknown',
        headerAliasMatches: {
          firstName: false,
          groupValue: false,
          lastName: false,
          schoolEmail: false,
          userId: false
        },
        headerMatches: {
          firstName: null,
          groupValue: null,
          lastName: null,
          schoolEmail: null,
          userId: null
        },
        normalizedHeaderCells: [],
        parserPath: 'not-run',
        rawHeaderCells: [],
        sampleRows: []
      });
      onMetadataSuggestionsChange?.({ className: '', programme: '' });
      return;
    }

    try {
      const result = await parseBoostcampGroupedFile(file);
      setRows(result.rows);
      setParseError(result.ok ? undefined : result.message);
      setParseMessage(result.ok ? result.message : undefined);
      setDebugInfo(result.debug);
      if (result.ok) {
        setNormalizationPreview(result.normalizationPreview);
        onMetadataSuggestionsChange?.(result.metadataSuggestions);
      } else {
        setNormalizationPreview([]);
        onMetadataSuggestionsChange?.({ className: '', programme: '' });
      }
      setSelectedClassNames(
        result.ok
          ? sortStrings(
              [...new Set(result.rows.map((row) => row.values.detectedClassName).filter(Boolean) as string[])]
            )
          : []
      );
      setDecisions({});
    } catch {
      setRows([]);
      setNormalizationPreview([]);
      setParseMessage(undefined);
      setParseError('Unable to read the selected CSV file.');
      setSelectedClassNames([]);
      setDecisions({});
      setDebugInfo({
        detectedDelimiter: 'unknown',
        headerAliasMatches: {
          firstName: false,
          groupValue: false,
          lastName: false,
          schoolEmail: false,
          userId: false
        },
        headerMatches: {
          firstName: null,
          groupValue: null,
          lastName: null,
          schoolEmail: null,
          userId: null
        },
        normalizedHeaderCells: [],
        parserPath: 'not-run',
        rawHeaderCells: [],
        sampleRows: []
      });
      onMetadataSuggestionsChange?.({ className: '', programme: '' });
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setRows([]);
      setNormalizationPreview([]);
      setFileName('');
      setDebugInfo(null);
      setParseMessage(undefined);
      setParseError(undefined);
      setSelectedClassNames([]);
      setDecisions({});
      onMetadataSuggestionsChange?.({ className: '', programme: '' });
      return;
    }

    await handleFile(file);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    await handleFile(file);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function updateDecision(rowId: string, mode: UnclassifiedDecisionMode) {
    setDecisions((current) => ({
      ...current,
      [rowId]: {
        mode,
        className: current[rowId]?.className ?? '',
        groupName: current[rowId]?.groupName ?? ''
      }
    }));
  }

  function updateManualDecision(
    rowId: string,
    field: 'className' | 'groupName',
    value: string
  ) {
    setDecisions((current) => ({
      ...current,
      [rowId]: {
        mode: 'manual',
        className: field === 'className' ? value : current[rowId]?.className ?? '',
        groupName:
          field === 'groupName'
            ? value
            : field === 'className'
              ? ''
              : current[rowId]?.groupName ?? ''
      }
    }));
  }

  const actionMessage = actionState.message;
  const hasInvalidData = invalidRows.length > 0;

  useEffect(() => {
    if (actionState.success) {
      onImportApplied?.();
    }
  }, [actionState.success, onImportApplied]);

  return (
    <section className="ui-panel grid gap-5 p-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Boostcamp grouped import</h2>
        <p className="text-sm text-[color:var(--app-fg-muted)]">
          Upload the Boostcamp CSV, resolve any unmatched rows, choose the classes to keep, then
          confirm the groups to create.
        </p>
      </div>

      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm text-[color:var(--app-fg-muted)]">
        <p className="font-medium text-[color:var(--app-fg)]">How to export from Boostcamp</p>
        <ol className="mt-2 grid list-decimal gap-1 pl-5">
          <li>Log in to Boostcamp.</li>
          <li>Open the course, then the episode where the activities live.</li>
          <li>Click the gear icon, then Participants.</li>
          <li>At the bottom, click “select all XX participants”.</li>
          <li>In the “choisir” dropdown, select CSV separated by commas.</li>
          <li>Download the file and upload it here.</li>
        </ol>
      </div>

      <div
        className={`grid gap-3 rounded-2xl border border-dashed px-4 py-4 transition ${
          isDragging
            ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
            : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]'
        }`}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="boostcampGroupedFile">
            CSV upload
          </label>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            Drag and drop a CSV here, or choose the Boostcamp export manually.
          </p>
        </div>
        <input
          accept=".csv,text/csv"
          className="ui-input"
          id="boostcampGroupedFile"
          name="boostcampGroupedFile"
          onChange={handleFileChange}
          type="file"
        />
        {fileName ? (
          <p className="text-xs text-[color:var(--app-fg-muted)]">Loaded file: {fileName}</p>
        ) : null}
      </div>

      {parseError ? (
        <p className="whitespace-pre-wrap text-sm text-[color:var(--app-danger)]">{parseError}</p>
      ) : null}
      {parseMessage ? (
        <p className="whitespace-pre-wrap text-sm text-[color:var(--app-fg-muted)]">
          {parseMessage}
        </p>
      ) : null}

      {debugInfo ? (
        <section className="grid gap-3 rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Temporary parser debug</h3>
            <p className="text-xs text-[color:var(--app-fg-muted)]">
              Development-only snapshot of what the grouped parser saw.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--app-fg-muted)]">
                File name
              </span>
              <span className="break-words">{fileName || 'Not loaded'}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--app-fg-muted)]">
                Parser path
              </span>
              <span>{debugInfo.parserPath}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--app-fg-muted)]">
                Detected delimiter
              </span>
              <span>{debugInfo.detectedDelimiter}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--app-fg-muted)]">
                Parsed message
              </span>
              <span className="break-words">{parseError ?? parseMessage ?? 'No message'}</span>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--app-fg-muted)]">
                Raw header cells
              </span>
              <pre className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 text-xs leading-5">
                {JSON.stringify(debugInfo.rawHeaderCells, null, 2)}
              </pre>
            </div>
            <div className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--app-fg-muted)]">
                Normalized header cells
              </span>
              <pre className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 text-xs leading-5">
                {JSON.stringify(debugInfo.normalizedHeaderCells, null, 2)}
              </pre>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--app-fg-muted)]">
                French alias matches
              </span>
              <pre className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 text-xs leading-5">
                {JSON.stringify(debugInfo.headerAliasMatches, null, 2)}
              </pre>
            </div>
            <div className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--app-fg-muted)]">
                Header matches
              </span>
              <pre className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 text-xs leading-5">
                {JSON.stringify(debugInfo.headerMatches, null, 2)}
              </pre>
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--app-fg-muted)]">
              First parsed data rows
            </span>
            <pre className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 text-xs leading-5">
              {JSON.stringify(debugInfo.sampleRows, null, 2)}
            </pre>
          </div>
        </section>
      ) : null}

      {actionMessage ? (
        <p
          className={
            actionState.success
              ? 'text-sm text-[color:var(--app-success)]'
              : 'text-sm text-[color:var(--app-danger)]'
          }
        >
          {actionMessage}
        </p>
      ) : null}

      {normalizationPreview.length > 0 ? (
        <section className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Normalization preview</h3>
              <p className="text-sm text-[color:var(--app-fg-muted)]">
                Review how each unique raw `Groupes` value was interpreted before applying the
                import.
              </p>
            </div>
            <span className="ui-chip">{normalizationPreview.length} unique values</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)]">
            <table className="min-w-full divide-y divide-[color:var(--app-border)] text-sm">
              <thead className="text-left text-[color:var(--app-fg-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Raw value</th>
                  <th className="px-4 py-3 font-medium">Parsed class</th>
                  <th className="px-4 py-3 font-medium">Parsed group</th>
                  <th className="px-4 py-3 font-medium">Users</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--app-border)]">
                {normalizationPreview.map((entry) => (
                  <tr key={entry.rawValue}>
                    <td className="px-4 py-3 align-top">
                      <div className="max-w-[26rem] break-words">{entry.rawValue}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-[color:var(--app-fg-muted)]">
                      {entry.parsedClassName ?? 'Not detected'}
                    </td>
                    <td className="px-4 py-3 align-top text-[color:var(--app-fg-muted)]">
                      {entry.parsedGroupName ?? 'Not detected'}
                    </td>
                    <td className="px-4 py-3 align-top text-[color:var(--app-fg-muted)]">
                      {entry.userCount}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`ui-chip ${
                          entry.confidenceLabel === 'high'
                            ? 'ui-chip-success'
                            : entry.confidenceLabel === 'low'
                              ? 'ui-chip-warning'
                              : ''
                        }`}
                      >
                        {entry.confidenceLabel} · {Math.round(entry.confidence * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <>
          {hasInvalidData ? (
            <div className="rounded-2xl border border-[color:var(--app-danger)]/20 bg-[color:var(--app-danger)]/10 px-4 py-3 text-sm text-[color:var(--app-danger)]">
              One or more rows still has a validation issue. Please fix the CSV and upload it
              again.
            </div>
          ) : null}

          {unresolvedRows.length > 0 ? (
            <section className="grid gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Unclassified users detected</h3>
                <p className="text-sm text-[color:var(--app-fg-muted)]">
                  These rows could not be matched automatically to a class or group. Please decide
                  what to do with them before continuing.
                </p>
              </div>

              <div className="grid gap-3">
                {unresolvedRows.map((row) => {
                  const decision = decisions[row.id] ?? {
                    mode: '',
                    className: '',
                    groupName: ''
                  };
                  const showManualFields = decision.mode === 'manual';

                  return (
                    <article
                      key={row.id}
                      className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">
                            {row.values.firstName} {row.values.lastName}
                          </div>
                          <div className="text-sm text-[color:var(--app-fg-muted)]">
                            {row.values.schoolEmail}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {row.issues.map((issue) => (
                            <span key={issue} className="ui-chip ui-chip-warning">
                              {issue}
                            </span>
                          ))}
                          <span
                            className={`ui-chip ${
                              row.values.confidenceLabel === 'high'
                                ? 'ui-chip-success'
                                : row.values.confidenceLabel === 'low'
                                  ? 'ui-chip-warning'
                                  : ''
                            }`}
                          >
                            {row.values.confidenceLabel} confidence
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        {[
                          ['ignore', 'Ignore this user'],
                          ['unassigned', 'Send to Unassigned students'],
                          ['manual', 'Assign manually now']
                        ].map(([value, label]) => (
                          <label
                            key={value}
                            className="flex items-center gap-2 rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-sm"
                          >
                            <input
                              checked={decision.mode === value}
                              name={`decision-${row.id}`}
                              onChange={() => updateDecision(row.id, value as UnclassifiedDecisionMode)}
                              type="radio"
                              value={value}
                            />
                            {label}
                          </label>
                        ))}
                      </div>

                      {showManualFields ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-2 text-sm font-medium">
                            Class
                            <select
                              className="ui-select"
                              value={decision.className}
                              onChange={(event) =>
                                updateManualDecision(row.id, 'className', event.target.value)
                              }
                            >
                              <option value="">Choose class</option>
                              {detectedClasses.map((className) => (
                                <option key={className} value={className}>
                                  {className}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="grid gap-2 text-sm font-medium">
                            Group
                            <select
                              className="ui-select"
                              value={decision.groupName}
                              onChange={(event) =>
                                updateManualDecision(row.id, 'groupName', event.target.value)
                              }
                            >
                              <option value="">No group yet</option>
                              {decision.className
                                ? sortStrings(
                                    [...new Set(
                                      rows
                                        .filter(
                                          (candidate) =>
                                            candidate.values.detectedClassName === decision.className &&
                                            candidate.values.detectedGroupName
                                        )
                                        .map((candidate) => candidate.values.detectedGroupName as string)
                                    )]
                                  ).map((groupName) => (
                                    <option key={groupName} value={groupName}>
                                      {groupName}
                                    </option>
                                  ))
                                : null}
                            </select>
                          </label>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {detectedClasses.length > 0 ? (
            <section className="grid gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Select the class(es) to work with</h3>
                <p className="text-sm text-[color:var(--app-fg-muted)]">
                  Choose the classes you want to keep in this import. Unselected classes will be
                  dropped from this import session.
                </p>
              </div>

              <div className="grid gap-3">
                {detectedClasses.map((className) => {
                  const classRows = rows.filter((row) => row.values.detectedClassName === className);
                  const groupedStudents = classRows.filter((row) => Boolean(row.values.detectedGroupName));
                  const unassignedStudents = classRows.filter((row) => !row.values.detectedGroupName);

                  return (
                    <label
                      key={className}
                      className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <input
                            checked={selectedClassNames.includes(className)}
                            onChange={(event) => {
                              setSelectedClassNames((current) =>
                                event.target.checked
                                  ? sortStrings([...new Set([...current, className])])
                                  : current.filter((value) => value !== className)
                              );
                            }}
                            type="checkbox"
                          />
                          <div>
                            <div className="font-medium">{className}</div>
                            <div className="text-sm text-[color:var(--app-fg-muted)]">
                              {classRows.length} students · {groupedStudents.length} already grouped ·{' '}
                              {unassignedStudents.length} unassigned
                            </div>
                          </div>
                        </div>
                        <span className="ui-chip">
                          {selectedClassNames.includes(className) ? 'Selected' : 'Not selected'}
                        </span>
                      </div>

                      <details className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2">
                        <summary className="cursor-pointer text-sm font-medium">
                          View detected groups
                        </summary>
                        <div className="mt-3 grid gap-1 text-sm text-[color:var(--app-fg-muted)]">
                          {sortStrings(
                            [...new Set(groupedStudents.map((student) => student.values.detectedGroupName as string))]
                          ).map((groupName) => (
                            <div key={groupName}>
                              {groupName}: {groupedStudents.filter((student) => student.values.detectedGroupName === groupName).length}
                            </div>
                          ))}
                          {groupedStudents.length === 0 ? <div>No groups detected.</div> : null}
                        </div>
                      </details>
                    </label>
                  );
                })}
              </div>

              <div className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm text-[color:var(--app-fg-muted)] md:grid-cols-4">
                <div>
                  <div className="font-medium text-[color:var(--app-fg)]">Selected classes</div>
                  <div>{selectedClassNames.length}</div>
                </div>
                <div>
                  <div className="font-medium text-[color:var(--app-fg)]">Selected students</div>
                  <div>{selectedRows.length}</div>
                </div>
                <div>
                  <div className="font-medium text-[color:var(--app-fg)]">Already grouped</div>
                  <div>{selectedRows.filter((row) => Boolean(row.groupName)).length}</div>
                </div>
                <div>
                  <div className="font-medium text-[color:var(--app-fg)]">Unassigned</div>
                  <div>{selectedRows.filter((row) => !row.groupName).length}</div>
                </div>
              </div>
            </section>
          ) : null}

          {selectedClassNames.length > 0 ? (
            <section className="grid gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Preview automatic dispatch</h3>
                <p className="text-sm text-[color:var(--app-fg-muted)]">
                  Review the groups that will be created or reused, then confirm the import.
                </p>
              </div>

              <div className="grid gap-4">
                {groupedAssignments.groups.length > 0 ? (
                  <div className="grid gap-3">
                    {groupedAssignments.groups.map((group) => (
                      <article
                        key={group.name}
                        className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="font-medium">{group.name}</div>
                          <span className="ui-chip">{group.memberEmails.length} students</span>
                        </div>
                        <div className="mt-3 grid gap-1 text-sm text-[color:var(--app-fg-muted)]">
                          {group.memberEmails.map((email) => (
                            <div key={email}>{email}</div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 text-sm text-[color:var(--app-fg-muted)]">
                    No groups will be created. These students will stay unassigned.
                  </div>
                )}

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">Unassigned students</div>
                      <div className="text-sm text-[color:var(--app-fg-muted)]">
                        These students will be imported without a group.
                      </div>
                    </div>
                    <span className="ui-chip">{groupedAssignments.unassignedStudents.length}</span>
                  </div>

                  {groupedAssignments.unassignedStudents.length > 0 ? (
                    <div className="mt-3 grid gap-1 text-sm text-[color:var(--app-fg-muted)]">
                      {groupedAssignments.unassignedStudents.map((student) => (
                        <div key={student.schoolEmail}>
                          {student.firstName} {student.lastName} · {student.schoolEmail}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <form action={formAction} className="grid gap-3">
                <input name="sessionId" type="hidden" value={sessionId} />
                <input name="payloadJson" type="hidden" value={payloadJson} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-[color:var(--app-fg-muted)]">
                    {selectedStudents.length} student
                    {selectedStudents.length === 1 ? '' : 's'} ready for grouped import.
                  </p>
                  <button
                    className="ui-button ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isPending || !canContinue || !payloadJson}
                    type="submit"
                  >
                    {isPending ? 'Applying...' : 'Confirm and apply'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
