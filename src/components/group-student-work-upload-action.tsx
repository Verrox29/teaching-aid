'use client';

import { useEffect, useState } from 'react';

import { AppModal } from '@/components/app-interaction-feedback';
import { GroupSubmissionDropzone } from '@/components/group-submission-dropzone';
import { useUiLanguage } from '@/components/ui-language-toggle';
import { getUiText } from '@/lib/ui-language';

type GroupStudentWorkUploadActionProps = {
  fileName?: string | null;
  groupId: string;
  groupName: string;
  returnTo: string;
  sessionId: string;
  submittedAt?: string | null;
};

function GroupUploadModal({
  fileName,
  groupId,
  groupName,
  onClose,
  returnTo,
  sessionId,
  submittedAt
}: GroupStudentWorkUploadActionProps & { onClose: () => void }) {
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).groupSubmission;

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
      headerLabel={t.uploadGroupWork}
      onClose={onClose}
      open
      title={groupName}
      widthClassName="w-[min(32rem,calc(100vw-2rem))]"
    >
      <GroupSubmissionDropzone
        fileName={fileName}
        groupId={groupId}
        groupName={groupName}
        returnPath={returnTo}
        sessionId={sessionId}
        submittedAt={submittedAt}
      />
    </AppModal>
  );
}

export function GroupStudentWorkUploadAction({
  fileName,
  groupId,
  groupName,
  returnTo,
  sessionId,
  submittedAt
}: GroupStudentWorkUploadActionProps) {
  const [open, setOpen] = useState(false);
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).groupSubmission;

  return (
    <>
      <button className="ui-button ui-button-secondary px-3 py-1.5 text-sm" onClick={() => setOpen(true)} type="button">
        {t.uploadGroupWork}
      </button>

      {open ? (
        <GroupUploadModal
          fileName={fileName}
          groupId={groupId}
          groupName={groupName}
          onClose={() => setOpen(false)}
          returnTo={returnTo}
          sessionId={sessionId}
          submittedAt={submittedAt}
        />
      ) : null}
    </>
  );
}
