'use client';

import { useEffect, useState } from 'react';

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
  sessionId: string;
  sessionTitle: string;
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

function UploadModal({
  groups,
  onClose,
  sessionId,
  sessionTitle
}: SessionUploadStudentsWorkActionProps & { onClose: () => void }) {
  const { uiLanguage } = useUiLanguage();
  const uiText = getUiText(uiLanguage);
  const t = uiText.sessionsHub;
  const shared = uiText.shared;

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
    <div className="fixed inset-0 z-50 bg-[color:rgba(17,12,25,0.38)] backdrop-blur-[2px]" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          aria-modal="true"
          className="w-[min(60rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="ui-section-title">{t.uploadStudentsWork}</p>
              <h2 className="text-xl font-semibold">{sessionTitle}</h2>
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

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <GroupSubmissionDropzone
                fileName={group.fileName}
                groupId={group.groupId}
                groupName={group.groupName}
                key={group.groupId}
                returnPath="/sessions"
                sessionId={sessionId}
                submittedAt={group.submittedAt}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionUploadStudentsWorkAction({
  groups,
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
        className="ui-button ui-button-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!hasGroups}
        onClick={() => {
          if (hasGroups) {
            setOpen(true);
          }
        }}
        title={hasGroups ? t.uploadStudentsWork : t.createGroupsFirst}
        type="button"
      >
        {t.uploadStudentsWork}
      </button>

      {open ? (
        <UploadModal
          groups={groups}
          onClose={() => setOpen(false)}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
        />
      ) : null}
    </>
  );
}
