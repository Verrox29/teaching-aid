'use client';

import { useId, useRef, useState, type FormEvent } from 'react';

import { uploadGroupSubmissionAction } from '@/app/sessions/[sessionId]/order/actions';
import { GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES, GROUP_SUBMISSION_MAX_FILE_SIZE_MB } from '@/lib/group-submission';
import { getUiText } from '@/lib/ui-language';
import { useUiLanguage } from '@/components/ui-language-toggle';

type GroupSubmissionDropzoneProps = {
  fileName?: string | null;
  groupId: string;
  groupName: string;
  sessionId: string;
  submittedAt?: string | null;
};

export function GroupSubmissionDropzone({
  fileName,
  groupId,
  groupName,
  sessionId,
  submittedAt
}: GroupSubmissionDropzoneProps) {
  const inputId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).groupSubmission;
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dragDepthRef = useRef(0);

  function rejectFile(fileName: string) {
    setSelectedFileName(null);
    setErrorMessage(
      `File "${fileName}" is too large. ${t.maxFileSize.replace('{size}', String(GROUP_SUBMISSION_MAX_FILE_SIZE_MB))}`
    );

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
    setErrorMessage(null);

    if (submitImmediately) {
      formRef.current?.requestSubmit();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const file = inputRef.current?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (file.size > GROUP_SUBMISSION_MAX_FILE_SIZE_BYTES) {
      event.preventDefault();
      rejectFile(file.name);
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  return (
    <form
      action={uploadGroupSubmissionAction}
      className={`grid gap-3 rounded-2xl border border-dashed p-4 text-sm transition ${
        isDragging
          ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
          : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] hover:border-[color:var(--app-accent)]'
      }`}
      ref={formRef}
      onSubmit={handleSubmit}
      onClick={openFilePicker}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
          setIsDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setIsDragging(false);
        const file = event.dataTransfer.files[0] ?? null;
        syncFile(file, true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openFilePicker();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <input name="sessionId" type="hidden" value={sessionId} />
      <input name="groupId" type="hidden" value={groupId} />

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
        {submittedAt ? <p className="mt-1 text-xs text-[color:var(--app-fg-muted)]">{t.uploadedOn.replace('{date}', submittedAt)}</p> : null}
      </div>

      <div className="grid gap-1">
        <span className="font-medium">{selectedFileName ?? fileName ?? t.dropOrChoose}</span>
        <span className="text-[color:var(--app-fg-muted)]">{t.oneFilePerGroup}</span>
      </div>

      <input
        ref={inputRef}
        className="sr-only"
        id={inputId}
        name="file"
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

      <div className="flex justify-end">
        <button
          className="ui-button ui-button-primary"
          type="submit"
          onClick={(event) => event.stopPropagation()}
        >
          {t.uploadButton}
        </button>
      </div>
    </form>
  );
}
