'use client';

import { useActionState, useEffect, useState } from 'react';

import { deleteSessionAction, type DeleteSessionFormState } from '@/app/sessions/actions';
import { getUiText } from '@/lib/ui-language';
import { useUiLanguage } from '@/components/ui-language-toggle';

type SessionDeleteActionProps = {
  sessionId: string;
  sessionTitle: string;
  triggerClassName?: string;
  triggerLabel?: string;
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

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 7H20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M8 7V5.5C8 4.67157 8.67157 4 9.5 4H14.5C15.3284 4 16 4.67157 16 5.5V7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M6 7L6.8 19.2C6.892 20.6038 8.0557 21.7 9.46256 21.7H14.5374C15.9443 21.7 17.108 20.6038 17.2 19.2L18 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M10 11V17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M14 11V17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function DeleteSessionConfirmDialog({
  onClose,
  sessionId,
  sessionTitle
}: {
  onClose: () => void;
  sessionId: string;
  sessionTitle: string;
}) {
  const { uiLanguage } = useUiLanguage();
  const shared = getUiText(uiLanguage).shared;
  const [state, formAction, isPending] = useActionState<DeleteSessionFormState, FormData>(
    deleteSessionAction,
    {}
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-[color:rgba(17,12,25,0.38)] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          aria-modal="true"
          className="w-[min(32rem,calc(100vw-2rem))] rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="ui-section-title">{shared.deleteSession}</p>
              <h2 className="text-xl font-semibold">{shared.deleteSessionConfirmTitle}</h2>
            </div>
            <button
              aria-label={shared.close}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-sm font-semibold text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-surface-soft)]"
              onClick={onClose}
              type="button"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <form action={formAction} className="mt-4 grid gap-4">
            <input name="sessionId" type="hidden" value={sessionId} />
            <p className="text-sm leading-6 text-[color:var(--app-fg-muted)]">
              {shared.deleteSessionConfirmBody.replace('{title}', sessionTitle)}
            </p>

            {state.error ? <p className="text-sm text-[color:var(--app-danger)]">{state.error}</p> : null}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                className="ui-button ui-button-secondary px-3 py-2 text-sm"
                onClick={onClose}
                type="button"
              >
                {shared.cancel}
              </button>
              <button
                className="ui-button ui-button-danger px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                <DeleteIcon className="h-4 w-4" />
                {isPending ? shared.deletingSession : shared.deleteSessionConfirmAction}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function SessionDeleteAction({
  sessionId,
  sessionTitle,
  triggerClassName = 'ui-button ui-button-danger px-3 py-2 text-sm',
  triggerLabel
}: SessionDeleteActionProps) {
  const { uiLanguage } = useUiLanguage();
  const shared = getUiText(uiLanguage).shared;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={triggerClassName}
        onClick={() => setOpen(true)}
        type="button"
      >
        <DeleteIcon className="h-4 w-4" />
        {triggerLabel ?? shared.deleteSession}
      </button>

      {open ? (
        <DeleteSessionConfirmDialog
          onClose={() => setOpen(false)}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
        />
      ) : null}
    </>
  );
}
