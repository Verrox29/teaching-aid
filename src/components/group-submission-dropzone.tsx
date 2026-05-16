'use client';

import { useId, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import { uploadGroupSubmissionAction } from '@/app/sessions/[sessionId]/order/actions';
import { AppPendingFormBridge } from '@/components/app-interaction-feedback';
import { GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES, GROUP_SUBMISSION_MAX_FILE_SIZE_MB } from '@/lib/group-submission';
import { formatUiDateTime, getUiText } from '@/lib/ui-language';
import { useUiLanguage } from '@/components/ui-language-toggle';

type GroupSubmissionDropzoneProps = {
  fileName?: string | null;
  fileInputName?: string;
  groupId: string;
  groupName: string;
  onUploadSuccess?: (payload: {
    fileName: string;
    message: string;
    submissionId: string | null;
    submittedAt: string;
  }) => void;
  onSelectedFileNameChange?: (fileName: string | null) => void;
  returnPath?: string;
  sessionId: string;
  submissionMode?: 'deferred' | 'immediate';
  uploadBehavior?: 'server-action' | 'inline-api';
  submittedAt?: string | null;
};

export function GroupSubmissionDropzone({
  fileName,
  fileInputName = 'file',
  groupId,
  groupName,
  onUploadSuccess,
  onSelectedFileNameChange,
  returnPath,
  sessionId,
  submissionMode = 'immediate',
  uploadBehavior = 'server-action',
  submittedAt
}: GroupSubmissionDropzoneProps) {
  const inputId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).groupSubmission;
  const formattedSubmittedAt = submittedAt ? formatUiDateTime(submittedAt, uiLanguage) : null;
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const dragDepthRef = useRef(0);
  const submitImmediately = submissionMode === 'immediate';
  const useInlineApiUpload = submitImmediately && uploadBehavior === 'inline-api';

  function rejectFile(fileName: string) {
    setSelectedFileName(null);
    onSelectedFileNameChange?.(null);
    setErrorMessage(t.fileTooLarge.replace('{size}', String(GROUP_SUBMISSION_MAX_FILE_SIZE_MB)));
    setSuccessMessage(null);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  function syncFile(file: File | null, submitImmediately: boolean) {
    if (!file) {
      return;
    }

    if (file.size > GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES) {
      rejectFile(file.name);
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    if (inputRef.current) {
      inputRef.current.files = dataTransfer.files;
    }

    setSelectedFileName(file.name);
    onSelectedFileNameChange?.(file.name);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (submitImmediately && formRef.current) {
      formRef.current?.requestSubmit();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const file = inputRef.current?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (file.size > GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES) {
      event.preventDefault();
      rejectFile(file.name);
      return;
    }

    if (!useInlineApiUpload) {
      return;
    }

    event.preventDefault();
    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const uploadFormData = new FormData();
    uploadFormData.set('file', file);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/submissions/${groupId}`, {
        body: uploadFormData,
        method: 'POST'
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMessage(
          typeof payload.message === 'string' && payload.message.trim().length > 0
            ? payload.message
            : 'Could not upload the file.'
        );
        return;
      }

      const submissionId =
        typeof payload.submissionId === 'string' && payload.submissionId.trim().length > 0
          ? payload.submissionId
          : null;
      const submittedAt =
        typeof payload.submittedAt === 'string' && payload.submittedAt.trim().length > 0
          ? payload.submittedAt
          : new Date().toISOString();
      const uploadedFileName =
        typeof payload.fileName === 'string' && payload.fileName.trim().length > 0
          ? payload.fileName
          : file.name;
      const message =
        typeof payload.message === 'string' && payload.message.trim().length > 0
          ? payload.message
          : `${uploadedFileName} uploaded.`;

      setSuccessMessage(message);
      setErrorMessage(null);
      setSelectedFileName(uploadedFileName);
      onUploadSuccess?.({
        fileName: uploadedFileName,
        message,
        submissionId,
        submittedAt
      });
    } catch {
      setErrorMessage('Could not upload the file.');
    } finally {
      setIsUploading(false);
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  const cardClassName = `grid gap-3 rounded-2xl border border-dashed p-4 text-sm transition ${
    isDragging
      ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
      : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] hover:border-[color:var(--app-accent)]'
  }`;

  const content = (
    <>
      {submissionMode === 'immediate' && !useInlineApiUpload ? <AppPendingFormBridge /> : null}
      {submissionMode === 'immediate' && !useInlineApiUpload ? (
        <input name="sessionId" type="hidden" value={sessionId} />
      ) : null}
      {submissionMode === 'immediate' && !useInlineApiUpload ? (
        <input name="groupId" type="hidden" value={groupId} />
      ) : null}
      {submissionMode === 'immediate' && !useInlineApiUpload && returnPath ? (
        <input name="returnTo" type="hidden" value={returnPath} />
      ) : null}

      <div className="grid gap-2 text-[color:var(--app-fg-muted)]">
        <p className="font-medium text-[color:var(--app-fg)]">{t.uploadGroupWork}</p>
        <p>{t.dropOrClick.replace('{groupName}', groupName)}</p>
        <p className="mt-1">{t.maxFileSize.replace('{size}', String(GROUP_SUBMISSION_MAX_FILE_SIZE_MB))}</p>
        <p>
          {t.compressFirst}{' '}
          <a
            className="font-medium text-[color:var(--app-accent-strong)] underline decoration-[color:var(--app-accent)] decoration-2 underline-offset-2 hover:text-[color:var(--app-accent)]"
            href="https://www.ilovepdf.com/fr/compresser_pdf"
            rel="noreferrer"
            target="_blank"
            onClick={(event) => event.stopPropagation()}
          >
            iLovePDF
          </a>
          .
        </p>
        {formattedSubmittedAt ? (
          <p className="mt-1 text-xs text-[color:var(--app-fg-muted)]">
            {t.uploadedOn.replace('{date}', formattedSubmittedAt)}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1">
        <span className="font-medium">{selectedFileName ?? fileName ?? t.dropOrChoose}</span>
        <span className="text-[color:var(--app-fg-muted)]">{t.oneFilePerGroup}</span>
      </div>

      <input
        ref={inputRef}
        className="sr-only"
        id={inputId}
        name={fileInputName}
        type="file"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          syncFile(file, false);
        }}
      />

      {selectedFileName ? (
        <p className="text-xs text-[color:var(--app-fg-muted)]">
          {t.selectedFile}: {selectedFileName}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-xs font-medium text-[color:var(--app-danger)]" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="text-xs font-medium text-[color:var(--app-success)]" aria-live="polite">
          {successMessage}
        </p>
      ) : null}

      {submissionMode === 'immediate' ? (
        <div className="flex justify-end">
          <button
            className="ui-button ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUploading}
            type="submit"
            onClick={(event) => event.stopPropagation()}
          >
            {isUploading ? `${t.uploadButton}...` : t.uploadButton}
          </button>
        </div>
      ) : null}
    </>
  );

  const sharedProps = {
    className: cardClassName,
    onClick: openFilePicker,
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDragging(true);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDragging(true);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragging(false);
      }
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);
      const file = event.dataTransfer.files[0] ?? null;
      syncFile(file, submitImmediately);
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFilePicker();
      }
    },
    role: 'button' as const,
    tabIndex: 0
  };

  if (submissionMode === 'deferred') {
    return <div {...sharedProps}>{content}</div>;
  }

  return (
    <form
      {...sharedProps}
      action={useInlineApiUpload ? undefined : uploadGroupSubmissionAction}
      ref={formRef}
      onSubmit={handleSubmit}
    >
      {content}
    </form>
  );
}
