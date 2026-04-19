"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';

import { importStudentsAction } from '@/app/sessions/[sessionId]/students/actions';
import { BoostcampExportGuide } from '@/components/boostcamp-export-guide';
import {
  parseStudentImportFile,
  parseStudentImportText,
  revalidateStudentImportRows,
  type StudentImportPreviewRow
} from '@/app/sessions/[sessionId]/students/import-utils';

type SessionStudentImportProps = {
  existingEmails: string[];
  onImportApplied?: () => void;
  sessionId: string;
  mode?: 'full' | 'file' | 'paste';
  showBoostcampGuide?: boolean;
};

type ImportActionState = {
  message?: string;
  success?: boolean;
};

const initialImportActionState: ImportActionState = {};

export function SessionStudentImport({
  existingEmails,
  onImportApplied,
  mode = 'full',
  sessionId,
  showBoostcampGuide = true
}: SessionStudentImportProps) {
  const [rows, setRows] = useState<StudentImportPreviewRow[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [parseMessage, setParseMessage] = useState<string>();
  const [parseError, setParseError] = useState<string>();
  const [isDragging, setIsDragging] = useState(false);
  const successHandledRef = useRef(false);
  const [actionState, formAction, isPending] = useActionState(
    importStudentsAction,
    initialImportActionState
  );

  const validRows = useMemo(() => rows.filter((row) => row.isValid), [rows]);
  const hasInvalidRows = rows.some((row) => !row.isValid);

  async function setParsedRowsFromResult(
    result: Awaited<ReturnType<typeof parseStudentImportFile>>
  ) {
    if (!result.ok) {
      setRows(result.rows);
      setParseMessage(undefined);
      setParseError(result.message);
      return;
    }

    setRows(result.rows);
    setParseError(undefined);
    setParseMessage(result.message);
  }

  async function handleFile(file: File) {
    try {
      const result = await parseStudentImportFile(file, existingEmails);
      await setParsedRowsFromResult(result);
    } catch {
      setRows([]);
      setParseMessage(undefined);
      setParseError('Unable to read the selected file.');
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setRows([]);
      setParseMessage(undefined);
      setParseError(undefined);
      return;
    }

    await handleFile(file);
  }

  async function handlePasteParse() {
    const result = parseStudentImportText(pastedText, existingEmails);
    await setParsedRowsFromResult(result);
  }

  useEffect(() => {
    if (actionState.success) {
      if (!successHandledRef.current) {
        successHandledRef.current = true;
        onImportApplied?.();
      }
      return;
    }

    successHandledRef.current = false;
  }, [actionState.success, onImportApplied]);

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

  function updateRowValue(
    rowId: string,
    field: 'firstName' | 'lastName' | 'schoolEmail',
    value: string
  ) {
    setRows((currentRows) =>
      revalidateStudentImportRows(
        currentRows.map((row) =>
          row.id === rowId
            ? {
                id: row.id,
                rowNumber: row.rowNumber,
                values: {
                  ...row.values,
                  [field]: value
                }
              }
            : {
                id: row.id,
                rowNumber: row.rowNumber,
                values: row.values
              }
        ),
        existingEmails
      )
    );
  }

  return (
    <section className="ui-panel grid gap-4 p-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Import students</h2>
        <p className="text-sm text-[color:var(--app-fg-muted)]">
          Upload a Boostcamp `.xlsx` file, paste roster text, or use a CSV with first name, last
          name, school email, and optional user ID columns.
        </p>
      </div>

      {showBoostcampGuide ? <BoostcampExportGuide /> : null}

      {mode !== 'paste' ? (
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
            <label className="text-sm font-medium" htmlFor="studentFile">
              File upload
            </label>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              Drag and drop a `.xlsx` or `.csv` file here, or choose one manually.
            </p>
          </div>
          <input
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="ui-input"
            id="studentFile"
            name="studentFile"
            onChange={handleFileChange}
            type="file"
          />
        </div>
      ) : null}

      {mode !== 'file' ? (
        <div className="grid gap-3">
          <label className="text-sm font-medium" htmlFor="pastedText">
            Or paste Boostcamp roster text
          </label>
          <textarea
            className="ui-textarea"
            id="pastedText"
            name="pastedText"
            onChange={(event) => setPastedText(event.target.value)}
            value={pastedText}
          />
          <div className="flex justify-end">
            <button
              className="ui-button ui-button-secondary"
              type="button"
              onClick={handlePasteParse}
              disabled={!pastedText.trim()}
            >
              Parse pasted text
            </button>
          </div>
        </div>
      ) : null}

      {parseError ? <p className="text-sm text-[color:var(--app-danger)]">{parseError}</p> : null}
      {parseMessage ? <p className="text-sm text-[color:var(--app-fg-muted)]">{parseMessage}</p> : null}
      {actionState.message ? (
        <p
          className={
            actionState.success
              ? 'text-sm text-[color:var(--app-success)]'
              : 'text-sm text-[color:var(--app-danger)]'
          }
        >
          {actionState.message}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <form action={formAction} className="grid gap-4">
          <input name="sessionId" type="hidden" value={sessionId} />
          <input
            name="rowsJson"
            type="hidden"
            value={JSON.stringify(validRows.map((row) => row.values))}
          />

          <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
            <table className="min-w-full divide-y divide-[color:var(--app-border)] text-sm">
              <thead className="text-left text-[color:var(--app-fg-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">User ID</th>
                  <th className="px-3 py-2 font-medium">First name</th>
                  <th className="px-3 py-2 font-medium">Last name</th>
                  <th className="px-3 py-2 font-medium">School email</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--app-border)] bg-[color:var(--app-surface)]">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.isValid ? '' : 'bg-[color:var(--app-surface-soft)]'}
                  >
                    <td className="px-3 py-3 align-top text-[color:var(--app-fg-muted)]">{row.rowNumber}</td>
                    <td className="px-3 py-3 align-top text-[color:var(--app-fg-muted)]">
                      {row.values.userId || '—'}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        className="ui-input py-2"
                        onChange={(event) =>
                          updateRowValue(row.id, 'firstName', event.target.value)
                        }
                        type="text"
                        value={row.values.firstName}
                      />
                      {row.errors.firstName ? (
                        <p className="mt-1 text-xs text-[color:var(--app-danger)]">
                          {row.errors.firstName}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        className="ui-input py-2"
                        onChange={(event) =>
                          updateRowValue(row.id, 'lastName', event.target.value)
                        }
                        type="text"
                        value={row.values.lastName}
                      />
                      {row.errors.lastName ? (
                        <p className="mt-1 text-xs text-[color:var(--app-danger)]">
                          {row.errors.lastName}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        className="ui-input py-2"
                        onChange={(event) =>
                          updateRowValue(row.id, 'schoolEmail', event.target.value)
                        }
                        type="email"
                        value={row.values.schoolEmail}
                      />
                      {row.errors.schoolEmail ? (
                        <p className="mt-1 text-xs text-[color:var(--app-danger)]">
                          {row.errors.schoolEmail}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top text-sm">
                      <span className={`ui-chip ${row.isValid ? 'ui-chip-success' : 'ui-chip-danger'}`}>
                        {row.isValid ? 'Valid' : 'Needs correction'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              {validRows.length} of {rows.length} row{rows.length > 1 ? 's' : ''} ready to import.
            </p>
            <button
              className="ui-button ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending || rows.length === 0 || hasInvalidRows}
              type="submit"
            >
              {isPending ? 'Importing...' : 'Import valid rows'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
