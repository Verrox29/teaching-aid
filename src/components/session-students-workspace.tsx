"use client";

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { saveExportMetadataAction } from '@/app/sessions/[sessionId]/exports/actions';
import { BoostcampExportGuide } from '@/components/boostcamp-export-guide';
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
  autoOpenImport?: boolean;
  metadata: SessionExportMetadata;
  sessionId: string;
  students: SessionStudentRecord[];
};

type ImportMode = 'chooser' | 'scratch' | 'grouped' | 'update-without-groups' | 'paste' | 'csv';
type MetadataSuggestionState = {
  className: string;
  programme: string;
};

function XIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.5 5.5L14.5 14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M14.5 5.5L5.5 14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FloatingModal({
  children,
  onClose,
  open,
  title,
  widthClassName = 'w-[min(56rem,calc(100vw-2rem))]'
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
  widthClassName?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[color:rgba(17,12,25,0.38)] backdrop-blur-[2px]" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          aria-modal="true"
          className={`${widthClassName} max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4`}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="ui-section-title">Pairagogie &amp; students setup</p>
              <h2 className="text-xl font-semibold">{title}</h2>
            </div>
            <button
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-sm font-semibold text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-surface-soft)]"
              onClick={onClose}
              type="button"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function SessionStudentsWorkspace({
  autoOpenImport = false,
  existingEmails,
  metadata,
  sessionId,
  students
}: SessionStudentsWorkspaceProps) {
  const [importOpen, setImportOpen] = useState(autoOpenImport);
  const [importMode, setImportMode] = useState<ImportMode>('chooser');
  const [metadataDraft, setMetadataDraft] = useState(metadata);
  const [metadataSuggestions, setMetadataSuggestions] = useState<MetadataSuggestionState>({
    className: '',
    programme: ''
  });

  useEffect(() => {
    if (autoOpenImport) {
      setImportOpen(true);
    }
  }, [autoOpenImport]);

  useEffect(() => {
    setMetadataDraft((current) =>
      current.className === metadata.className &&
      current.professorName === metadata.professorName &&
      current.programme === metadata.programme &&
      current.season === metadata.season &&
      current.sessionDate === metadata.sessionDate &&
      current.subject === metadata.subject
        ? current
        : metadata
    );
  }, [metadata]);

  useEffect(() => {
    if (!importOpen) {
      setImportMode('chooser');
    }
  }, [importOpen]);

  const hasStudents = students.length > 0;

  const handleImportApplied = useCallback(() => {
    setImportOpen(false);
    setImportMode('chooser');
  }, []);

  const handleMetadataSuggestionsChange = useCallback(
    (nextSuggestions: MetadataSuggestionState) => {
      setMetadataSuggestions((current) =>
        current.className === nextSuggestions.className &&
        current.programme === nextSuggestions.programme
          ? current
          : nextSuggestions
      );

      setMetadataDraft((current) => {
        const nextDraft = {
          ...current,
          className: nextSuggestions.className || current.className,
          programme: nextSuggestions.programme || current.programme
        };

        return nextDraft.className === current.className &&
          nextDraft.programme === current.programme
          ? current
          : nextDraft;
      });
    },
    []
  );

  function updateMetadataField(field: keyof SessionExportMetadata, value: string) {
    setMetadataDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function closeImport() {
    setImportOpen(false);
  }

  function renderImportChoices() {
    if (importMode === 'update-without-groups') {
      return (
        <section className="grid gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Update without groups</h3>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              Choose whether to paste roster text or update from CSV.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="ui-button ui-button-secondary" type="button" onClick={() => setImportMode('paste')}>
              Paste Boostcamp roster text
            </button>
            <button className="ui-button ui-button-secondary" type="button" onClick={() => setImportMode('csv')}>
              Update from csv file
            </button>
            <button className="ui-button ui-button-ghost" type="button" onClick={() => setImportMode('chooser')}>
              Back
            </button>
          </div>

          <BoostcampExportGuide />
        </section>
      );
    }

    return (
      <section className="grid gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{hasStudents ? 'Update students' : 'Start students import'}</h3>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            {hasStudents
              ? 'Choose whether the incoming file includes groups or only roster data.'
              : 'Choose how to begin the first import for this session.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {hasStudents ? (
            <>
              <button className="ui-button ui-button-primary" type="button" onClick={() => setImportMode('grouped')}>
                Update with groups
              </button>
              <button
                className="ui-button ui-button-secondary"
                type="button"
                onClick={() => setImportMode('update-without-groups')}
              >
                Update without groups
              </button>
            </>
          ) : (
            <>
              <button className="ui-button ui-button-secondary" type="button" onClick={() => setImportMode('scratch')}>
                No. Start from scratch
              </button>
              <button className="ui-button ui-button-primary" type="button" onClick={() => setImportMode('grouped')}>
                Yes. I&apos;ll upload the csv file
              </button>
            </>
          )}
        </div>

        <BoostcampExportGuide />
      </section>
    );
  }

  function renderImportBody() {
    if (importMode === 'scratch') {
      return (
        <SessionStudentImport
          existingEmails={existingEmails}
          mode="full"
          onImportApplied={handleImportApplied}
          sessionId={sessionId}
          showBoostcampGuide
        />
      );
    }

    if (importMode === 'grouped') {
      return (
        <SessionBoostcampGroupedImport
          onImportApplied={handleImportApplied}
          onMetadataSuggestionsChange={handleMetadataSuggestionsChange}
          sessionId={sessionId}
        />
      );
    }

    if (importMode === 'paste') {
      return (
        <SessionStudentImport
          existingEmails={existingEmails}
          mode="paste"
          onImportApplied={handleImportApplied}
          sessionId={sessionId}
          showBoostcampGuide
        />
      );
    }

    if (importMode === 'csv') {
      return (
        <SessionStudentImport
          existingEmails={existingEmails}
          mode="file"
          onImportApplied={handleImportApplied}
          sessionId={sessionId}
          showBoostcampGuide
        />
      );
    }

    return renderImportChoices();
  }

  return (
    <div className="grid gap-6">
      <section className="ui-panel grid gap-5 p-6">
        <div className="space-y-1">
          <p className="ui-section-title">Pairagogie &amp; students setup</p>
          <h2 className="text-xl font-semibold">Pairagogie session metadata</h2>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            Save the session details used by exports.
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
              Save Pairagogie &amp; students setup
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Imported students</h2>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              Students already saved in this session roster.
            </p>
          </div>
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
                    <td className="px-4 py-3 text-[color:var(--app-fg-muted)]">{student.schoolEmail}</td>
                    <td className="px-4 py-3 text-[color:var(--app-fg-muted)]">{student.createdAtLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <FloatingModal onClose={closeImport} open={importOpen} title="Pairagogie & students setup">
        <div className="grid gap-5">
          {renderImportBody()}
        </div>
      </FloatingModal>
    </div>
  );
}
