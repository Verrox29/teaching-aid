'use client';

import { useEffect, useState } from 'react';

import {
  lockGroupSelectionAction,
  unlockGroupSelectionAction
} from '@/app/sessions/[sessionId]/groups/actions';
import { AppModal, AppPendingFormBridge } from '@/components/app-interaction-feedback';
import { useUiLanguage } from '@/components/ui-language-toggle';
import { getUiText } from '@/lib/ui-language';

type SessionGroupLockToggleActionProps = {
  groupSelectionLocked: boolean;
  sessionId: string;
  sessionTitle: string;
};

function SessionGroupLockConfirmDialog({
  groupSelectionLocked,
  onClose,
  sessionId,
  sessionTitle
}: SessionGroupLockToggleActionProps & { onClose: () => void }) {
  const { uiLanguage } = useUiLanguage();
  const shared = getUiText(uiLanguage).shared;
  const t = getUiText(uiLanguage).sessionsHub;
  const action = groupSelectionLocked ? unlockGroupSelectionAction : lockGroupSelectionAction;

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
      title={groupSelectionLocked ? t.unlockGroupsConfirmTitle : t.lockGroupsConfirmTitle}
      widthClassName="w-[min(32rem,calc(100vw-2rem))]"
    >
      <form action={action} className="mt-4 grid gap-4">
        <AppPendingFormBridge
          label={groupSelectionLocked ? t.unlockGroupsConfirmAction : t.lockGroupsConfirmAction}
        />
        <input name="sessionId" type="hidden" value={sessionId} />
        <p className="text-sm leading-6 text-[color:var(--app-fg-muted)]">
          {(groupSelectionLocked ? t.unlockGroupsConfirmBody : t.lockGroupsConfirmBody).replace(
            '{title}',
            sessionTitle
          )}
        </p>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            className="ui-button ui-button-secondary px-3 py-2 text-sm"
            onClick={onClose}
            type="button"
          >
            {shared.cancel}
          </button>
          <button
            className="ui-button ui-button-primary px-3 py-2 text-sm"
            type="submit"
          >
            {groupSelectionLocked ? t.unlockGroupsConfirmAction : t.lockGroupsConfirmAction}
          </button>
        </div>
      </form>
    </AppModal>
  );
}

export function SessionGroupLockToggleAction({
  groupSelectionLocked,
  sessionId,
  sessionTitle
}: SessionGroupLockToggleActionProps) {
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).sessionsHub;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={`ui-chip transition hover:brightness-95 ${
          groupSelectionLocked ? 'ui-chip-warning' : 'ui-chip-success'
        }`}
        onClick={() => setOpen(true)}
        type="button"
      >
        {groupSelectionLocked ? t.locked : t.open}
      </button>

      {open ? (
        <SessionGroupLockConfirmDialog
          groupSelectionLocked={groupSelectionLocked}
          onClose={() => setOpen(false)}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
        />
      ) : null}
    </>
  );
}
