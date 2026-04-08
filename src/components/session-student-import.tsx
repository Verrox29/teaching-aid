'use client';

import { useActionState, useMemo, useState } from 'react';

import { importStudentsAction } from '@/app/sessions/[sessionId]/students/actions';
import {
  parseStudentCsv,
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
  const [parseMessage, setParseMessage] = useState<string>();
  const [parseError, setParseError] = useState<string>();
  const [actionState, formAction, isPending] = useActionState(
    importStudentsAction,
    initialImportActionState
  );

  const validRows = useMemo(() => rows.filter((row) => row.isValid), [rows]);
  const hasInvalidRows = rows.some((row) => !row.isValid);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setRows([]);
      setParseMessage(undefined);
      setParseError(undefined);
      return;
    }

    try {
      const csvText = await file.text();
      const result = parseStudentCsv(csvText, existingEmails);

      if (!result.ok) {
        setRows(result.rows);
        setParseMessage(undefined);
        setParseError(result.message);
        return;
      }

      setRows(result.rows);
      setParseError(undefined);
      setParseMessage(result.message);
    } catch {
      setRows([]);
      setParseMessage(undefined);
      setParseError('Unable to read the selected CSV file.');
    }
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
          Upload a CSV with first name, last name, and school email columns.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-900" htmlFor="studentCsv">
          CSV file
        </label>
        <input
          accept=".csv,text/csv"
          className="block rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
          id="studentCsv"
          name="studentCsv"
          onChange={handleFileChange}
          type="file"
        />
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
