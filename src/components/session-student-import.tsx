"use client";

import { useActionState, useMemo, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';

import { importStudentsAction } from '@/app/sessions/[sessionId]/students/actions';
import {
  parseStudentImportFile,
  parseStudentImportText,
  revalidateStudentImportRows,
  type StudentImportPreviewRow
} from '@/app/sessions/[sessionId]/students/import-utils';

type SessionStudentImportProps = {
  existingEmails: string[];
  sessionId: string;
};

type ImportActionState = {
  message?: string;
  success?: boolean;
};

const initialImportActionState: ImportActionState = {};

export function SessionStudentImport({
  existingEmails,
  sessionId
}: SessionStudentImportProps) {
  const [rows, setRows] = useState<StudentImportPreviewRow[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [parseMessage, setParseMessage] = useState<string>();
  const [parseError, setParseError] = useState<string>();
  const [isDragging, setIsDragging] = useState(false);
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
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-900">Import students</h2>
        <p className="text-sm text-slate-600">
          Upload a Boostcamp `.xlsx` file, paste roster text, or use a CSV with first name, last name, school email, and optional user ID columns.
        </p>
      </div>

      <div
        className={`grid gap-3 rounded-xl border border-dashed px-4 py-4 transition ${
          isDragging ? 'border-slate-900 bg-slate-50' : 'border-slate-300 bg-slate-50/40'
        }`}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-900" htmlFor="studentFile">
            File upload
          </label>
          <p className="text-sm text-slate-600">
            Drag and drop a `.xlsx` or `.csv` file here, or choose one manually.
          </p>
        </div>
        <input
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          id="studentFile"
          name="studentFile"
          onChange={handleFileChange}
          type="file"
        />
      </div>

      <div className="grid gap-3">
        <label className="text-sm font-medium text-slate-900" htmlFor="pastedText">
          Or paste Boostcamp roster text
        </label>
        <textarea
          className="min-h-40 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-slate-500"
          id="pastedText"
          name="pastedText"
          onChange={(event) => setPastedText(event.target.value)}
          value={pastedText}
        />
        <div className="flex justify-end">
          <button
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            type="button"
            onClick={handlePasteParse}
            disabled={!pastedText.trim()}
          >
            Parse pasted text
          </button>
        </div>
      </div>

      {parseError ? <p className="text-sm text-rose-600">{parseError}</p> : null}
      {parseMessage ? <p className="text-sm text-slate-600">{parseMessage}</p> : null}
      {actionState.message ? (
        <p className={actionState.success ? 'text-sm text-emerald-700' : 'text-sm text-rose-600'}>
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

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">User ID</th>
                  <th className="px-3 py-2 font-medium">First name</th>
                  <th className="px-3 py-2 font-medium">Last name</th>
                  <th className="px-3 py-2 font-medium">School email</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row) => (
                  <tr key={row.id} className={row.isValid ? 'bg-white' : 'bg-rose-50'}>
                    <td className="px-3 py-3 align-top text-slate-500">{row.rowNumber}</td>
                    <td className="px-3 py-3 align-top text-slate-700">
                      {row.values.userId || '—'}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(event) =>
                          updateRowValue(row.id, 'firstName', event.target.value)
                        }
                        type="text"
                        value={row.values.firstName}
                      />
                      {row.errors.firstName ? (
                        <p className="mt-1 text-xs text-rose-600">{row.errors.firstName}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(event) =>
                          updateRowValue(row.id, 'lastName', event.target.value)
                        }
                        type="text"
                        value={row.values.lastName}
                      />
                      {row.errors.lastName ? (
                        <p className="mt-1 text-xs text-rose-600">{row.errors.lastName}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(event) =>
                          updateRowValue(row.id, 'schoolEmail', event.target.value)
                        }
                        type="email"
                        value={row.values.schoolEmail}
                      />
                      {row.errors.schoolEmail ? (
                        <p className="mt-1 text-xs text-rose-600">{row.errors.schoolEmail}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top text-sm">
                      {row.isValid ? (
                        <span className="text-emerald-700">Valid</span>
                      ) : (
                        <span className="text-rose-700">Needs correction</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              {validRows.length} of {rows.length} row{rows.length > 1 ? 's' : ''} ready to import.
            </p>
            <button
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
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
