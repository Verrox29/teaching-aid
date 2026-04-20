'use client';

import { useActionState, useEffect, useState } from 'react';

import { deleteSessionAction, type DeleteSessionFormState } from '@/app/sessions/actions';
import { AppModal, AppPendingFormBridge } from '@/components/app-interaction-feedback';
import { getUiText } from '@/lib/ui-language';
import { useUiLanguage } from '@/components/ui-language-toggle';

type SessionDeleteActionProps = {
  sessionId: string;
  sessionTitle: string;
  triggerClassName?: string;
  triggerLabel?: string;
};

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
    <AppModal
      headerLabel={shared.teacherAdmin}
      onClose={onClose}
      open
      title={shared.deleteSessionConfirmTitle}
      widthClassName="w-[min(32rem,calc(100vw-2rem))]"
    >
      <form action={formAction} className="mt-4 grid gap-4">
        <AppPendingFormBridge label={shared.deletingSession} />
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
    </AppModal>
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
