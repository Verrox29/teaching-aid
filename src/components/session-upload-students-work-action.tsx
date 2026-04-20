'use client';

import { useEffect, useState } from 'react';

import { AppModal } from '@/components/app-interaction-feedback';
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

function UploadModal({
  groups,
  onClose,
  sessionId,
  sessionTitle
}: SessionUploadStudentsWorkActionProps & { onClose: () => void }) {
  const { uiLanguage } = useUiLanguage();
  const uiText = getUiText(uiLanguage);
  const t = uiText.sessionsHub;

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
      headerLabel={t.uploadStudentsWork}
      onClose={onClose}
      open
      title={sessionTitle}
      widthClassName="w-[min(60rem,calc(100vw-2rem))]"
    >
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
    </AppModal>
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
