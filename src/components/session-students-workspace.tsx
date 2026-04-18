"use client";

import { useCallback, useEffect, useState } from 'react';

import { saveExportMetadataAction } from '@/app/sessions/[sessionId]/exports/actions';
import { SessionBoostcampGroupedImport } from '@/components/session-boostcamp-grouped-import';
import { SessionStudentImport } from '@/components/session-student-import';

type SessionExportMetadata = {
  className: string;
  professorName: string;
  programme: string;
  season: string;
  sessionDate: string;
  subject: string;
};

type SessionStudentRecord = {
  createdAtLabel: string;
  firstName: string;
  id: string;
  lastName: string;
  schoolEmail: string;
};

type SessionStudentsWorkspaceProps = {
  existingEmails: string[];
  metadata: SessionExportMetadata;
  sessionId: string;
  students: SessionStudentRecord[];
};

type WorkspaceTab = 'setup' | 'import';
type ImportMode = '' | 'scratch' | 'grouped';
type MetadataSuggestionState = {
  className: string;
  programme: string;
};

export function SessionStudentsWorkspace({
  existingEmails,
  metadata,
  sessionId,
  students
}: SessionStudentsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('import');
  const [importMode, setImportMode] = useState<ImportMode>('');
  const [metadataDraft, setMetadataDraft] = useState(metadata);
  const [metadataSuggestions, setMetadataSuggestions] = useState<MetadataSuggestionState>({
    className: '',
    programme: ''
  });

  useEffect(() => {
    setMetadataDraft(metadata);
  }, [metadata]);

  const handleMetadataSuggestionsChange = useCallback(
    (nextSuggestions: MetadataSuggestionState) => {
      setMetadataSuggestions((current) =>
        current.className === nextSuggestions.className &&
        current.programme === nextSuggestions.programme
          ? current
          : nextSuggestions
      );

      setMetadataDraft((current) => ({
        ...current,
        className: nextSuggestions.className || current.className,
        programme: nextSuggestions.programme || current.programme
      }));
    },
    []
  );

  function updateMetadataField(field: keyof SessionExportMetadata, value: string) {
    setMetadataDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  return (
    <div className="grid gap-6">
      <section className="ui-panel overflow-hidden">
        <div className="border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                activeTab === 'import'
                  ? 'bg-[color:var(--app-accent)]/10 text-[color:var(--app-accent-strong)] ring-1 ring-[color:var(--app-accent)]/20'
                  : 'text-[color:var(--app-fg-muted)] hover:bg-[color:var(--app-surface-muted)]'
              }`}
              type="button"
              onClick={() => setActiveTab('import')}
            >
              <div className="text-xs uppercase tracking-[0.2em]">Tab 1</div>
              <div className="mt-1 text-base">Student import</div>
            </button>
            <button
              className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                activeTab === 'setup'
                  ? 'bg-[color:var(--app-accent)]/10 text-[color:var(--app-accent-strong)] ring-1 ring-[color:var(--app-accent)]/20'
                  : 'text-[color:var(--app-fg-muted)] hover:bg-[color:var(--app-surface-muted)]'
              }`}
              type="button"
              onClick={() => setActiveTab('setup')}
            >
              <div className="text-xs uppercase tracking-[0.2em]">Tab 2</div>
              <div className="mt-1 text-base">Pairagogie setup</div>
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-6">
          {activeTab === 'import' ? (
            <div className="grid gap-6">
              <section className="grid gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">Student import</h2>
                  <p className="text-sm text-[color:var(--app-fg-muted)]">
                    Choose how to start the import. The current manual flow stays available, and
                    the Boostcamp grouped flow lives in the same tab.
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                  <p className="text-sm font-medium">Were the groups already created on Boostcamp?</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      className={`ui-button ${importMode === 'scratch' ? 'ui-button-primary' : 'ui-button-secondary'}`}
                      type="button"
                      onClick={() => setImportMode('scratch')}
                    >
                      No. Start from scratch
                    </button>
                    <button
                      className={`ui-button ${importMode === 'grouped' ? 'ui-button-primary' : 'ui-button-secondary'}`}
                      type="button"
                      onClick={() => setImportMode('grouped')}
                    >
                      Yes. I&apos;ll upload the csv file
                    </button>
                  </div>
                </div>
              </section>

              {importMode === 'scratch' ? (
                <SessionStudentImport existingEmails={existingEmails} sessionId={sessionId} />
              ) : null}

              {importMode === 'grouped' ? (
                <SessionBoostcampGroupedImport
                  onImportApplied={() => setActiveTab('setup')}
                  onMetadataSuggestionsChange={handleMetadataSuggestionsChange}
                  sessionId={sessionId}
                />
              ) : null}
            </div>
          ) : null}

          {activeTab === 'setup' ? (
            <section className="grid gap-5">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Pairagogie session metadata</h2>
                <p className="text-sm text-[color:var(--app-fg-muted)]">
                  Save the session details used by exports. Student import now lives in the
                  previous tab.
                </p>
                {metadataSuggestions.className || metadataSuggestions.programme ? (
                  <p className="text-xs text-[color:var(--app-fg-muted)]">
                    Suggested from imported Boostcamp data.
                  </p>
                ) : null}
              </div>

              <form action={saveExportMetadataAction} className="grid gap-4">
                <input name="sessionId" type="hidden" value={sessionId} />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="grid gap-2 text-sm font-medium">
                    Programme
                    <input
                      className="ui-input"
                      name="programme"
                      onChange={(event) => updateMetadataField('programme', event.target.value)}
                      value={metadataDraft.programme}
                      type="text"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Class name
                    <input
                      className="ui-input"
                      name="className"
                      onChange={(event) => updateMetadataField('className', event.target.value)}
                      value={metadataDraft.className}
                      type="text"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Subject
                    <input
                      className="ui-input"
                      name="subject"
                      onChange={(event) => updateMetadataField('subject', event.target.value)}
                      value={metadataDraft.subject}
                      type="text"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Professor name
                    <input
                      className="ui-input"
                      name="professorName"
                      onChange={(event) => updateMetadataField('professorName', event.target.value)}
                      value={metadataDraft.professorName}
                      type="text"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Presentation date
                    <input
                      className="ui-input"
                      name="sessionDate"
                      onChange={(event) => updateMetadataField('sessionDate', event.target.value)}
                      value={metadataDraft.sessionDate}
                      type="text"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium">
                    Season
                    <select
                      className="ui-select"
                      name="season"
                      onChange={(event) => updateMetadataField('season', event.target.value)}
                      value={metadataDraft.season}
                      required
                    >
                      <option disabled value="">
                        Choose season
                      </option>
                      <option value="Fall">Fall</option>
                      <option value="Spring">Spring</option>
                    </select>
                  </label>
                </div>

                <div className="flex justify-end">
                  <button className="ui-button ui-button-primary" type="submit">
                    Save Pairagogie setup
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="grid gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Imported students</h2>
              <p className="text-sm text-[color:var(--app-fg-muted)]">
                Students already saved in this session roster.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
              <table className="min-w-full divide-y divide-[color:var(--app-border)] text-sm">
                <thead className="text-left text-[color:var(--app-fg-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">First name</th>
                    <th className="px-4 py-3 font-medium">Last name</th>
                    <th className="px-4 py-3 font-medium">School email</th>
                    <th className="px-4 py-3 font-medium">Imported at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--app-border)] bg-[color:var(--app-surface)]">
                  {students.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-[color:var(--app-fg-muted)]" colSpan={4}>
                        No students imported yet.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id}>
                        <td className="px-4 py-3">{student.firstName}</td>
                        <td className="px-4 py-3">{student.lastName}</td>
                        <td className="px-4 py-3 text-[color:var(--app-fg-muted)]">
                          {student.schoolEmail}
                        </td>
                        <td className="px-4 py-3 text-[color:var(--app-fg-muted)]">
                          {student.createdAtLabel}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
