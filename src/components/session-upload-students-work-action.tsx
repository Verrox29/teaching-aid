'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import { uploadSelectedGroupSubmissionsAction } from '@/app/sessions/[sessionId]/order/actions';
import { AppModal, AppPendingFormBridge } from '@/components/app-interaction-feedback';
import { GroupSubmissionDropzone } from '@/components/group-submission-dropzone';
import { useUiLanguage } from '@/components/ui-language-toggle';
import { getUiText } from '@/lib/ui-language';

type SessionHubUploadGroup = {
  fileName: string | null;
  groupId: string;
  groupName: string;
  submittedAt: string | null;
};

type SessionUploadStudentsWorkActionProps = {
  groups: SessionHubUploadGroup[];
  triggerClassName?: string;
  sessionId: string;
  sessionTitle: string;
  returnTo?: string;
};

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12.5535 2.49392C12.4114 2.33852 12.2106 2.25 12 2.25C11.7894 2.25 11.5886 2.33852 11.4465 2.49392L7.44648 6.86892C7.16698 7.17462 7.18822 7.64902 7.49392 7.92852C7.79963 8.20802 8.27402 8.18678 8.55352 7.88108L11.25 4.9318V16C11.25 16.4142 11.5858 16.75 12 16.75C12.4142 16.75 12.75 16.4142 12.75 16V4.9318L15.4465 7.88108C15.726 8.18678 16.2004 8.20802 16.5061 7.92852C16.8118 7.64902 16.833 7.17462 16.5535 6.86892L12.5535 2.49392Z"
        fill="currentColor"
      />
      <path
        d="M3.75 15C3.75 14.5858 3.41422 14.25 3 14.25C2.58579 14.25 2.25 14.5858 2.25 15V15.0549C2.24998 16.4225 2.24996 17.5248 2.36652 18.3918C2.48754 19.2919 2.74643 20.0497 3.34835 20.6516C3.95027 21.2536 4.70814 21.5125 5.60825 21.6335C6.47522 21.75 7.57754 21.75 8.94513 21.75H15.0549C16.4225 21.75 17.5248 21.75 18.3918 21.6335C19.2919 21.5125 20.0497 21.2536 20.6517 20.6516C21.2536 20.0497 21.5125 19.2919 21.6335 18.3918C21.75 17.5248 21.75 16.4225 21.75 15.0549V15C21.75 14.5858 21.4142 14.25 21 14.25C20.5858 14.25 20.25 14.5858 20.25 15C20.25 16.4354 20.2484 17.4365 20.1469 18.1919C20.0482 18.9257 19.8678 19.3142 19.591 19.591C19.3142 19.8678 18.9257 20.0482 18.1919 20.1469C17.4365 20.2484 16.4354 20.25 15 20.25H9C7.56459 20.25 6.56347 20.2484 5.80812 20.1469C5.07435 20.0482 4.68577 19.8678 4.40901 19.591C4.13225 19.3142 3.9518 18.9257 3.85315 18.1919C3.75159 17.4365 3.75 16.4354 3.75 15Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getGroupSortKey(groupName: string) {
  const match = /^Group\s+(\d+)$/i.exec(groupName.trim());
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function UploadModal({
  groups,
  onClose,
  returnTo = '/sessions',
  sessionId,
  sessionTitle
}: SessionUploadStudentsWorkActionProps & { onClose: () => void }) {
  const { uiLanguage } = useUiLanguage();
  const uiText = getUiText(uiLanguage);
  const t = uiText.sessionsHub;
  const formId = useId();
  const [selectedFileNames, setSelectedFileNames] = useState<Record<string, string>>({});
  const sortedGroups = useMemo(
    () =>
      [...groups].sort((left, right) => {
        const leftOrder = getGroupSortKey(left.groupName);
        const rightOrder = getGroupSortKey(right.groupName);
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.groupName.localeCompare(right.groupName, 'en', { sensitivity: 'base' });
      }),
    [groups]
  );
  const selectedCount = Object.keys(selectedFileNames).length;

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
      headerActions={
        <button
          className="ui-button ui-button-primary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          disabled={selectedCount === 0}
          form={formId}
          type="submit"
        >
          {t.uploadAllSelectedFiles}
        </button>
      }
      headerLabel={t.uploadStudentsWork}
      onClose={onClose}
      open
      title={sessionTitle}
      widthClassName="w-[min(60rem,calc(100vw-2rem))]"
    >
      <form action={uploadSelectedGroupSubmissionsAction} id={formId}>
        <AppPendingFormBridge label={t.uploadingSelectedFiles} />
        <input name="sessionId" type="hidden" value={sessionId} />
        <input name="returnTo" type="hidden" value={returnTo} />
        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-[color:var(--app-fg-muted)]">
          <p>{t.batchUploadHelp}</p>
          <p>{selectedCount === 0 ? '0 selected' : `${selectedCount} selected`}</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedGroups.map((group) => (
            <div key={group.groupId}>
              <input name="groupId" type="hidden" value={group.groupId} />
              <GroupSubmissionDropzone
                fileName={group.fileName}
                fileInputName={`file:${group.groupId}`}
                groupId={group.groupId}
                groupName={group.groupName}
                onSelectedFileNameChange={(fileName) => {
                  setSelectedFileNames((current) => {
                    const next = { ...current };
                    if (!fileName) {
                      delete next[group.groupId];
                    } else {
                      next[group.groupId] = fileName;
                    }
                    return next;
                  });
                }}
                sessionId={sessionId}
                submissionMode="deferred"
                submittedAt={group.submittedAt}
              />
            </div>
          ))}
        </div>
      </form>
    </AppModal>
  );
}

export function SessionUploadStudentsWorkAction({
  groups,
  triggerClassName,
  returnTo = '/sessions',
  sessionId,
  sessionTitle
}: SessionUploadStudentsWorkActionProps) {
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).sessionsHub;
  const [open, setOpen] = useState(false);
  const hasGroups = groups.length > 0;

  return (
    <>
      <button
        aria-disabled={!hasGroups}
        aria-haspopup="dialog"
        className={`${triggerClassName ?? `inline-flex items-center gap-1 text-sm font-medium underline-offset-4 ${
          hasGroups
            ? 'text-[color:var(--app-accent-strong)] hover:underline'
            : 'cursor-not-allowed text-[color:var(--app-fg-muted)] no-underline'
        }`} disabled:cursor-not-allowed disabled:opacity-60`}
        disabled={!hasGroups}
        onClick={() => {
          if (hasGroups) {
            setOpen(true);
          }
        }}
        title={hasGroups ? t.uploadStudentsWork : t.createGroupsFirst}
        type="button"
      >
        <UploadIcon className="h-4 w-4" />
        {t.uploadStudentsWork}
      </button>

      {open ? (
        <UploadModal
          groups={groups}
          onClose={() => setOpen(false)}
          returnTo={returnTo}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
        />
      ) : null}
    </>
  );
}
