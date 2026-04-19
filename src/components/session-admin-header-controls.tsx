'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { saveSessionContextAction, saveSessionInstructionsAction, undoSessionContextAction, undoSessionInstructionsAction } from '@/app/sessions/actions';
import type { SessionAdminHeaderState } from '@/lib/session-admin-state';

import { ThemeToggle } from './theme-toggle';

type SessionAdminHeaderControlsProps = {
  sessionId: string;
  slug: string;
  state: SessionAdminHeaderState;
};

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.25 4.75L3.75 10L8.25 15.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path
        d="M16.25 10H4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1.25C12.4142 1.25 12.75 1.58579 12.75 2V4C12.75 4.41421 12.4142 4.75 12 4.75C11.5858 4.75 11.25 4.41421 11.25 4V2C11.25 1.58579 11.5858 1.25 12 1.25ZM3.66865 3.71609C3.94815 3.41039 4.42255 3.38915 4.72825 3.66865L6.95026 5.70024C7.25596 5.97974 7.2772 6.45413 6.9977 6.75983C6.7182 7.06553 6.2438 7.08677 5.9381 6.80727L3.71609 4.77569C3.41039 4.49619 3.38915 4.02179 3.66865 3.71609ZM20.3314 3.71609C20.6109 4.02179 20.5896 4.49619 20.2839 4.77569L18.0619 6.80727C17.7562 7.08677 17.2818 7.06553 17.0023 6.75983C16.7228 6.45413 16.744 5.97974 17.0497 5.70024L19.2718 3.66865C19.5775 3.38915 20.0518 3.41039 20.3314 3.71609ZM12 7.75C9.65279 7.75 7.75 9.65279 7.75 12C7.75 14.3472 9.65279 16.25 12 16.25C14.3472 16.25 16.25 14.3472 16.25 12C16.25 9.65279 14.3472 7.75 12 7.75ZM6.25 12C6.25 8.82436 8.82436 6.25 12 6.25C15.1756 6.25 17.75 8.82436 17.75 12C17.75 15.1756 15.1756 17.75 12 17.75C8.82436 17.75 6.25 15.1756 6.25 12ZM1.25 12C1.25 11.5858 1.58579 11.25 2 11.25H4C4.41421 11.25 4.75 11.5858 4.75 12C4.75 12.4142 4.41421 12.75 4 12.75H2C1.58579 12.75 1.25 12.4142 1.25 12ZM19.25 12C19.25 11.5858 19.5858 11.25 20 11.25H22C22.4142 11.25 22.75 11.5858 22.75 12C22.75 12.4142 22.4142 12.75 22 12.75H20C19.5858 12.75 19.25 12.4142 19.25 12ZM17.0255 17.0252C17.3184 16.7323 17.7933 16.7323 18.0862 17.0252L20.3082 19.2475C20.6011 19.5404 20.601 20.0153 20.3081 20.3082C20.0152 20.6011 19.5403 20.601 19.2475 20.3081L17.0255 18.0858C16.7326 17.7929 16.7326 17.3181 17.0255 17.0252ZM6.97467 17.0253C7.26756 17.3182 7.26756 17.7931 6.97467 18.086L4.75244 20.3082C4.45955 20.6011 3.98468 20.6011 3.69178 20.3082C3.39889 20.0153 3.39889 19.5404 3.69178 19.2476L5.91401 17.0253C6.2069 16.7324 6.68177 16.7324 6.97467 17.0253ZM12 19.25C12.4142 19.25 12.75 19.5858 12.75 20V22C12.75 22.4142 12.4142 22.75 12 22.75C11.5858 22.75 11.25 22.4142 11.25 22V20C11.25 19.5858 11.5858 19.25 12 19.25Z"
      />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.75 3.75L16.25 6.25L7.25 15.25H4.75V12.75L13.75 3.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path d="M12.5 5L15 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

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

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 11.5373 21.3065 11.4608 21.0672 11.8568C19.9289 13.7406 17.8615 15 15.5 15C11.9101 15 9 12.0899 9 8.5C9 6.13845 10.2594 4.07105 12.1432 2.93276C12.5392 2.69347 12.4627 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1.25C12.4142 1.25 12.75 1.58579 12.75 2V4C12.75 4.41421 12.4142 4.75 12 4.75C11.5858 4.75 11.25 4.41421 11.25 4V2C11.25 1.58579 11.5858 1.25 12 1.25ZM3.66865 3.71609C3.94815 3.41039 4.42255 3.38915 4.72825 3.66865L6.95026 5.70024C7.25596 5.97974 7.2772 6.45413 6.9977 6.75983C6.7182 7.06553 6.2438 7.08677 5.9381 6.80727L3.71609 4.77569C3.41039 4.49619 3.38915 4.02179 3.66865 3.71609ZM20.3314 3.71609C20.6109 4.02179 20.5896 4.49619 20.2839 4.77569L18.0619 6.80727C17.7562 7.08677 17.2818 7.06553 17.0023 6.75983C16.7228 6.45413 16.744 5.97974 17.0497 5.70024L19.2718 3.66865C19.5775 3.38915 20.0518 3.41039 20.3314 3.71609ZM12 7.75C9.65279 7.75 7.75 9.65279 7.75 12C7.75 14.3472 9.65279 16.25 12 16.25C14.3472 16.25 16.25 14.3472 16.25 12C16.25 9.65279 14.3472 7.75 12 7.75ZM6.25 12C6.25 8.82436 8.82436 6.25 12 6.25C15.1756 6.25 17.75 8.82436 17.75 12C17.75 15.1756 15.1756 17.75 12 17.75C8.82436 17.75 6.25 15.1756 6.25 12ZM1.25 12C1.25 11.5858 1.58579 11.25 2 11.25H4C4.41421 11.25 4.75 11.5858 4.75 12C4.75 12.4142 4.41421 12.75 4 12.75H2C1.58579 12.75 1.25 12.4142 1.25 12ZM19.25 12C19.25 11.5858 19.5858 11.25 20 11.25H22C22.4142 11.25 22.75 11.5858 22.75 12C22.75 12.4142 22.4142 12.75 22 12.75H20C19.5858 12.75 19.25 12.4142 19.25 12ZM17.0255 17.0252C17.3184 16.7323 17.7933 16.7323 18.0862 17.0252L20.3082 19.2475C20.6011 19.5404 20.601 20.0153 20.3081 20.3082C20.0152 20.6011 19.5403 20.601 19.2475 20.3081L17.0255 18.0858C16.7326 17.7929 16.7326 17.3181 17.0255 17.0252ZM6.97467 17.0253C7.26756 17.3182 7.26756 17.7931 6.97467 18.086L4.75244 20.3082C4.45955 20.6011 3.98468 20.6011 3.69178 20.3082C3.39889 20.0153 3.39889 19.5404 3.69178 19.2476L5.91401 17.0253C6.2069 16.7324 6.68177 16.7324 6.97467 17.0253ZM12 19.25C12.4142 19.25 12.75 19.5858 12.75 20V22C12.75 22.4142 12.4142 22.75 12 22.75C11.5858 22.75 11.25 22.4142 11.25 22V20C11.25 19.5858 11.5858 19.25 12 19.25Z"
      />
    </svg>
  );
}

function ActionModal({
  children,
  onClose,
  open,
  title,
  widthClassName = 'w-[min(44rem,calc(100vw-2rem))]'
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
              <p className="ui-section-title">Teacher admin</p>
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

export function SessionAdminHeaderControls({ sessionId, slug, state }: SessionAdminHeaderControlsProps) {
  const [contextOpen, setContextOpen] = useState(false);
  const [contextEditorOpen, setContextEditorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsEditorOpen, setSettingsEditorOpen] = useState(false);

  const assignmentBriefPreview = state.assignmentBrief.trim();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      if (contextEditorOpen) {
        setContextEditorOpen(false);
        return;
      }

      if (settingsEditorOpen) {
        setSettingsEditorOpen(false);
        return;
      }

      if (contextOpen) {
        setContextOpen(false);
        return;
      }

      if (settingsOpen) {
        setSettingsOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [contextEditorOpen, contextOpen, settingsEditorOpen, settingsOpen]);

  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link className="ui-button ui-button-secondary px-3 py-2 text-sm" href="/sessions">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to sessions list
          </Link>
          <Link className="ui-button ui-button-secondary px-3 py-2 text-sm" href={`/s/${slug}`}>
            Public Enrolment page
          </Link>
          <button
            aria-haspopup="dialog"
            aria-expanded={contextOpen}
            className="ui-button ui-button-secondary px-3 py-2 text-sm"
            onClick={() => setContextOpen(true)}
            type="button"
          >
            Session context
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            aria-label="Settings"
            className="ui-button ui-button-secondary h-9 w-9 px-0"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            <GearIcon className="h-4 w-4" />
          </button>
          <ThemeToggle />
        </div>
      </div>

      <ActionModal onClose={() => setContextOpen(false)} open={contextOpen} title="Session context">
        <section className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['Programme', state.sessionContext.programme],
              ['Class', state.sessionContext.className],
              ['Subject', state.sessionContext.subject],
              ['Season', state.sessionContext.season],
              ['Professor', state.sessionContext.professorName],
              ['Presentation date', state.sessionContext.sessionDate]
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-sm"
              >
                <p className="ui-section-title">{label}</p>
                <p className="mt-1 font-medium leading-5">{value || 'Not set'}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              className="ui-button ui-button-secondary px-3 py-2 text-sm"
              onClick={() => {
                setContextOpen(false);
                setContextEditorOpen(true);
              }}
              type="button"
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </button>
            {state.canUndoSessionContext ? (
              <form action={undoSessionContextAction}>
                <input name="sessionId" type="hidden" value={sessionId} />
                <button className="ui-button ui-button-secondary px-3 py-2 text-sm" type="submit">
                  Undo
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </ActionModal>

      <ActionModal
        onClose={() => setContextEditorOpen(false)}
        open={contextEditorOpen}
        title="Edit session context"
        widthClassName="w-[min(52rem,calc(100vw-2rem))]"
      >
        <form action={saveSessionContextAction} className="grid gap-4">
          <input name="sessionId" type="hidden" value={sessionId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Class
              <input className="ui-input" defaultValue={state.sessionContext.className} name="className" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Programme
              <input className="ui-input" defaultValue={state.sessionContext.programme} name="programme" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Subject
              <input className="ui-input" defaultValue={state.sessionContext.subject} name="subject" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Season
              <select className="ui-select" defaultValue={state.sessionContext.season} name="season">
                <option value="">Not set</option>
                <option value="Fall">Fall</option>
                <option value="Spring">Spring</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Professor
              <input className="ui-input" defaultValue={state.sessionContext.professorName} name="professorName" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Presentation date
              <input className="ui-input" defaultValue={state.sessionContext.sessionDate} name="sessionDate" />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-[color:var(--app-fg-muted)]">
              Changes save immediately across the session.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {state.canUndoSessionContext ? (
                <button
                  className="ui-button ui-button-secondary px-3 py-2 text-sm"
                  formAction={undoSessionContextAction}
                  type="submit"
                >
                  Undo
                </button>
              ) : null}
              <button className="ui-button ui-button-primary px-3 py-2 text-sm" type="submit">
                Save context
              </button>
            </div>
          </div>
        </form>
      </ActionModal>

      <ActionModal onClose={() => setSettingsOpen(false)} open={settingsOpen} title="Settings">
        <section className="grid gap-4">
          <div className="grid gap-2">
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
              <p className="ui-section-title">Assignment brief</p>
              <p className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-[color:var(--app-fg-muted)]">
                {assignmentBriefPreview || 'No assignment brief yet.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              className="ui-button ui-button-secondary px-3 py-2 text-sm"
              onClick={() => {
                setSettingsOpen(false);
                setSettingsEditorOpen(true);
              }}
              type="button"
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </button>
            {state.canUndoAssignmentBrief ? (
              <form action={undoSessionInstructionsAction}>
                <input name="sessionId" type="hidden" value={sessionId} />
                <button className="ui-button ui-button-secondary px-3 py-2 text-sm" type="submit">
                  Undo
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </ActionModal>

      <ActionModal
        onClose={() => setSettingsEditorOpen(false)}
        open={settingsEditorOpen}
        title="Edit assignment brief"
        widthClassName="w-[min(58rem,calc(100vw-2rem))]"
      >
        <form action={saveSessionInstructionsAction} className="grid gap-4">
          <input name="sessionId" type="hidden" value={sessionId} />
          <label className="grid gap-2 text-sm font-medium">
            Assignment brief
            <textarea
              className="ui-textarea min-h-[18rem]"
              defaultValue={state.assignmentBrief}
              name="instructions"
              placeholder="Describe the activity, expectations, and anything the AI should consider."
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-[color:var(--app-fg-muted)]">
              Changes save immediately across the session.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {state.canUndoAssignmentBrief ? (
                <button
                  className="ui-button ui-button-secondary px-3 py-2 text-sm"
                  formAction={undoSessionInstructionsAction}
                  type="submit"
                >
                  Undo
                </button>
              ) : null}
              <button className="ui-button ui-button-primary px-3 py-2 text-sm" type="submit">
                Save brief
              </button>
            </div>
          </div>
        </form>
      </ActionModal>
    </>
  );
}
