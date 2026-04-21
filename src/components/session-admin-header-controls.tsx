'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { saveSessionContextAction, saveSessionInstructionsAction, undoSessionContextAction, undoSessionInstructionsAction } from '@/app/sessions/actions';
import { AppModal, AppPendingFormBridge } from '@/components/app-interaction-feedback';
import { ResponsiveBackActionContent } from '@/components/back-action';
import type { SessionAdminHeaderState } from '@/lib/session-admin-state';
import { getUiText } from '@/lib/ui-language';
import { useUiLanguage } from '@/components/ui-language-toggle';
import { SessionDeleteAction } from '@/components/session-delete-action';

import { ThemeToggle } from './theme-toggle';
import { UiLanguageToggle } from './ui-language-toggle';

type SessionAdminHeaderControlsProps = {
  sessionId: string;
  sessionTitle: string;
  currentStep?: number;
  state: SessionAdminHeaderState;
};

function GearIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path d="M499.139,318.571l-37.178-5.407c-2.329-0.178-4.336-1.642-5.228-3.8l-12.054-29.086c-0.901-2.15-0.526-4.613,1-6.379l22.243-29.88c3.533-4.141,3.301-10.314-0.554-14.168l-17.602-17.594c-3.846-3.854-10.029-4.104-14.159-0.553l-29.889,22.233c-1.758,1.518-4.238,1.91-6.38,1.018l-29.094-12.062c-2.151-0.883-3.622-2.926-3.81-5.228l-5.389-37.169c-0.428-5.442-4.96-9.635-10.402-9.635h-24.893c-5.45,0-9.983,4.193-10.402,9.635l-5.407,37.169c-0.17,2.32-1.642,4.345-3.792,5.228l-29.103,12.062c-2.151,0.892-4.613,0.5-6.388-1.018l-29.872-22.233c-4.13-3.542-10.304-3.302-14.167,0.553l-17.594,17.594c-3.854,3.854-4.086,10.028-0.554,14.168l22.234,29.888c1.508,1.758,1.91,4.229,1.009,6.371l-12.054,29.086c-0.874,2.159-2.908,3.622-5.219,3.81l-37.195,5.398c-5.425,0.429-9.618,4.961-9.618,10.412v24.883c0,5.442,4.194,9.993,9.618,10.403l37.195,5.398c2.311,0.188,4.345,1.659,5.219,3.81l12.054,29.086c0.901,2.159,0.5,4.63-1.009,6.388l-22.234,29.889c-3.533,4.14-3.301,10.295,0.554,14.168l17.594,17.594c3.863,3.854,10.037,4.086,14.167,0.544l29.872-22.243c1.775-1.498,4.237-1.9,6.388-0.998l29.103,12.044c2.151,0.902,3.622,2.918,3.802,5.246l5.398,37.169c0.428,5.433,4.952,9.636,10.402,9.636h24.893c5.451,0,9.974-4.203,10.402-9.636l5.389-37.169c0.188-2.328,1.659-4.344,3.81-5.246l29.103-12.044c2.142-0.902,4.622-0.5,6.379,0.998l29.881,22.243c4.13,3.542,10.314,3.31,14.159-0.544l17.602-17.594c3.864-3.873,4.087-10.028,0.554-14.168l-22.243-29.889c-1.499-1.758-1.9-4.229-1-6.388l12.054-29.086c0.892-2.151,2.899-3.622,5.228-3.81l37.178-5.398c5.434-0.41,9.627-4.961,9.627-10.403v-24.883C508.766,323.532,504.573,319,499.139,318.571z M379.093,382.328c-10.93,10.912-25.445,16.926-40.898,16.926c-15.444,0-29.978-6.014-40.898-16.926c-10.92-10.938-16.943-25.454-16.943-40.907c0-15.444,6.022-29.969,16.943-40.89c10.92-10.939,25.454-16.934,40.898-16.934c15.454,0,29.969,5.995,40.898,16.934c10.92,10.92,16.934,25.446,16.934,40.89C396.027,356.874,390.014,371.39,379.093,382.328z" />
        <path d="M187.351,252.156c4.032-1.445,6.254-5.746,5.122-9.868l-5.898-28.854c-0.472-1.767,0.072-3.649,1.419-4.88l18.263-16.621c1.338-1.222,3.284-1.588,4.97-0.946l27.961,8.466c3.989,1.508,8.485-0.294,10.306-4.166l8.297-17.656c1.837-3.881,0.366-8.485-3.346-10.591l-24.339-16.14c-1.58-0.91-2.535-2.632-2.436-4.452l1.16-24.66c0.098-1.829,1.186-3.444,2.838-4.194l26.008-13.874c3.898-1.74,5.781-6.218,4.336-10.215l-6.603-18.371c-1.454-4.024-5.755-6.254-9.876-5.121l-28.863,5.879c-1.767,0.5-3.632-0.053-4.871-1.41L195.185,56.23c-1.24-1.357-1.614-3.265-0.955-4.978l8.468-27.944c1.507-4.006-0.294-8.494-4.175-10.306l-17.648-8.306c-3.872-1.821-8.494-0.366-10.608,3.354l-16.131,24.34c-0.902,1.58-2.623,2.533-4.444,2.445l-24.66-1.169c-1.82-0.08-3.462-1.205-4.202-2.847L106.974,4.821c-1.758-3.898-6.219-5.782-10.234-4.336L78.379,7.096c-4.024,1.446-6.254,5.738-5.112,9.859l5.888,28.872c0.482,1.748-0.062,3.64-1.418,4.862l-18.264,16.63c-1.356,1.222-3.274,1.597-4.987,0.955l-27.944-8.476c-3.988-1.516-8.476,0.304-10.305,4.175L7.939,81.622c-1.82,3.872-0.366,8.494,3.346,10.599l24.339,16.14c1.588,0.902,2.534,2.615,2.436,4.435l-1.16,24.66c-0.071,1.838-1.187,3.444-2.837,4.193L8.055,155.522c-3.9,1.749-5.782,6.219-4.336,10.216l6.611,18.37c1.445,4.024,5.746,6.254,9.859,5.131l28.881-5.906c1.749-0.482,3.64,0.071,4.862,1.427l16.612,18.255c1.24,1.356,1.598,3.283,0.954,4.987l-8.466,27.944c-1.499,3.997,0.304,8.485,4.175,10.305l17.648,8.297c3.881,1.829,8.493,0.357,10.608-3.346l16.122-24.348c0.91-1.57,2.623-2.534,4.452-2.428l24.661,1.16c1.829,0.09,3.453,1.178,4.211,2.846l13.847,25.989c1.767,3.9,6.219,5.8,10.233,4.354L187.351,252.156z M148.229,172.296c-11.394,4.095-23.714,3.524-34.68-1.633c-10.965-5.157-19.245-14.275-23.358-25.678c-4.095-11.402-3.524-23.714,1.634-34.67c5.156-10.974,14.283-19.254,25.677-23.357c11.402-4.105,23.714-3.534,34.67,1.641c10.956,5.139,19.254,14.258,23.366,25.66c4.096,11.403,3.516,23.706-1.632,34.672C168.731,159.886,159.621,168.183,148.229,172.296z" />
      </g>
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

export function SessionAdminHeaderControls({
  sessionId,
  sessionTitle,
  currentStep,
  state
}: SessionAdminHeaderControlsProps) {
  type FloatingModal = 'settings' | 'editSessionContext' | 'editAssignmentBrief';

  const [modalStack, setModalStack] = useState<FloatingModal[]>([]);
  const { uiLanguage } = useUiLanguage();
  const shared = getUiText(uiLanguage).shared;
  const t = getUiText(uiLanguage).sessionAdmin;

  const assignmentBriefPreview = state.assignmentBrief.trim();
  const activeModal = modalStack[modalStack.length - 1] ?? null;
  const settingsOpen = activeModal === 'settings';
  const contextEditorOpen = activeModal === 'editSessionContext';
  const settingsEditorOpen = activeModal === 'editAssignmentBrief';

  function openModal(modal: FloatingModal) {
    setModalStack((current) => [...current, modal]);
  }

  function closeTopModal() {
    setModalStack((current) => current.slice(0, -1));
  }

  function closeAllModals() {
    setModalStack([]);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || modalStack.length === 0) {
        return;
      }

      event.preventDefault();
      closeTopModal();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modalStack.length]);

  return (
    <>
      <div className="flex w-full min-w-0 flex-wrap items-start justify-end gap-2 lg:w-auto lg:flex-nowrap">
        <div className="flex min-w-0 flex-wrap items-start justify-end gap-2 lg:flex-nowrap">
          <Link className="ui-button ui-button-secondary shrink-0 px-3 py-2 text-sm" href="/sessions">
            <ResponsiveBackActionContent label={shared.backToSessionsHub} />
          </Link>
          <button
            aria-haspopup="dialog"
            aria-expanded={modalStack.length > 0}
            aria-label={t.settings}
            className="ui-button ui-button-ghost h-9 w-9 shrink-0 px-0"
            onClick={() => {
              if (!settingsOpen) {
                openModal('settings');
              }
            }}
            type="button"
          >
            <GearIcon className="h-4 w-4" />
          </button>
          <div className="shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </div>

      <AppModal
        headerActions={<UiLanguageToggle />}
        headerLabel={shared.teacherAdmin}
        onClose={closeAllModals}
        open={settingsOpen}
        title={t.settings}
      >
        <section className="grid gap-5">
          <div className="grid gap-2">
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <p className="ui-section-title">{t.sessionContextSummary}</p>
                  <div className="grid gap-1 text-sm text-[color:var(--app-fg-muted)]">
                    <p>
                      <span className="font-medium text-[color:var(--app-fg)]">{t.class}:</span>{' '}
                      {state.sessionContext.className || shared.notSet}
                    </p>
                    <p>
                      <span className="font-medium text-[color:var(--app-fg)]">{shared.programme}:</span>{' '}
                      {state.sessionContext.programme || shared.notSet}
                    </p>
                    <p>
                      <span className="font-medium text-[color:var(--app-fg)]">{t.intake}:</span>{' '}
                      {state.sessionContext.season || shared.notSet}
                    </p>
                    <p>
                      <span className="font-medium text-[color:var(--app-fg)]">{shared.date}:</span>{' '}
                      {state.sessionContext.sessionDate || shared.notSet}
                    </p>
                  </div>
                </div>
                <button
                  className="ui-button ui-button-secondary px-3 py-2 text-sm"
                  onClick={() => {
                    openModal('editSessionContext');
                  }}
                  type="button"
                >
                  <PencilIcon className="h-4 w-4" />
                  {t.edit}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="ui-section-title">{t.pairagogieSetup}</p>
                  <p className="text-sm text-[color:var(--app-fg-muted)]">
                    Import students, refresh the roster, and keep the setup current.
                  </p>
                </div>
                <Link
                  className="ui-button ui-button-secondary px-3 py-2 text-sm"
                  href={`/sessions/${sessionId}/students?setup=1`}
                >
                  <PencilIcon className="h-4 w-4" />
                  {t.edit}
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link className="ui-button ui-button-secondary px-3 py-2 text-sm" href={`/sessions/${sessionId}/students?setup=1`}>
                  {t.openStudentsSetup}
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="ui-section-title">{t.assignmentBriefSummary}</p>
                  <p className="max-h-24 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-[color:var(--app-fg-muted)]">
                    {assignmentBriefPreview || t.noAssignmentBrief}
                  </p>
                </div>
                <button
                  className="ui-button ui-button-secondary px-3 py-2 text-sm"
                  onClick={() => {
                    openModal('editAssignmentBrief');
                  }}
                  type="button"
                >
                  <PencilIcon className="h-4 w-4" />
                  {t.edit}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                {state.canUndoAssignmentBrief ? (
                  <form action={undoSessionInstructionsAction}>
                    <AppPendingFormBridge />
                    <input name="sessionId" type="hidden" value={sessionId} />
                    <button className="ui-button ui-button-secondary px-3 py-2 text-sm" type="submit">
                      {t.undo}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="rounded-2xl border border-[color:var(--app-danger)]/20 bg-[color:var(--app-danger)]/8 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="ui-section-title text-[color:var(--app-danger)]">{shared.deleteSession}</p>
                  <p className="text-sm text-[color:var(--app-fg-muted)]">
                    {shared.deleteSessionConfirmBody.replace('{title}', sessionTitle)}
                  </p>
                </div>
                <SessionDeleteAction sessionId={sessionId} sessionTitle={sessionTitle} />
              </div>
            </div>
          </div>
        </section>
      </AppModal>

      <AppModal
        backLabel={uiLanguage === 'fr' ? 'Retour' : 'Back'}
        headerLabel={shared.teacherAdmin}
        onBack={closeTopModal}
        onClose={closeTopModal}
        open={settingsEditorOpen}
        showBackButton
        title={t.editAssignmentBrief}
        widthClassName="w-[min(58rem,calc(100vw-2rem))]"
      >
        <form action={saveSessionInstructionsAction} className="grid gap-4">
          <AppPendingFormBridge />
          <input name="sessionId" type="hidden" value={sessionId} />
          <label className="grid gap-2 text-sm font-medium">
            {t.assignmentBrief}
            <textarea
              className="ui-textarea min-h-[18rem]"
              defaultValue={state.assignmentBrief}
              name="instructions"
              placeholder={t.assignmentBriefPlaceholder}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-[color:var(--app-fg-muted)]">
              {t.changesSavedAcrossSession}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {state.canUndoAssignmentBrief ? (
                <button
                  className="ui-button ui-button-secondary px-3 py-2 text-sm"
                  formAction={undoSessionInstructionsAction}
                  type="submit"
                >
                  {t.undo}
                </button>
              ) : null}
              <button className="ui-button ui-button-primary px-3 py-2 text-sm" type="submit">
                {t.saveBrief}
              </button>
            </div>
          </div>
        </form>
      </AppModal>

      <AppModal
        backLabel={uiLanguage === 'fr' ? 'Retour' : 'Back'}
        headerLabel={shared.teacherAdmin}
        onBack={closeTopModal}
        onClose={closeTopModal}
        open={contextEditorOpen}
        showBackButton
        title={t.editSessionContext}
        widthClassName="w-[min(52rem,calc(100vw-2rem))]"
      >
        <form action={saveSessionContextAction} className="grid gap-4">
          <AppPendingFormBridge />
          <input name="sessionId" type="hidden" value={sessionId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              {t.class}
              <input className="ui-input" defaultValue={state.sessionContext.className} name="className" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {shared.programme}
              <input className="ui-input" defaultValue={state.sessionContext.programme} name="programme" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {t.subject}
              <input className="ui-input" defaultValue={state.sessionContext.subject} name="subject" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {t.season}
              <select className="ui-select" defaultValue={state.sessionContext.season || 'Fall'} name="season">
                <option value="Fall">Fall</option>
                <option value="Spring">Spring</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {t.professor}
              <input className="ui-input" defaultValue={state.sessionContext.professorName} name="professorName" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {t.presentationDate}
              <input className="ui-input" defaultValue={state.sessionContext.sessionDate} name="sessionDate" type="date" />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-[color:var(--app-fg-muted)]">
              {t.changesSavedAcrossSession}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {state.canUndoSessionContext ? (
                <button
                  className="ui-button ui-button-secondary px-3 py-2 text-sm"
                  formAction={undoSessionContextAction}
                  type="submit"
                >
                  {t.undo}
                </button>
              ) : null}
              <button className="ui-button ui-button-primary px-3 py-2 text-sm" type="submit">
                {t.saveContext}
              </button>
            </div>
          </div>
        </form>
      </AppModal>
    </>
  );
}
