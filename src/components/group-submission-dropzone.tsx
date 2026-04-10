'use client';

import { useId, useRef, useState } from 'react';

import { uploadGroupSubmissionAction } from '@/app/sessions/[sessionId]/order/actions';

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
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  function syncFile(file: File | null, submitImmediately: boolean) {
    if (!file) {
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    if (inputRef.current) {
      inputRef.current.files = dataTransfer.files;
    }

    setSelectedFileName(file.name);

    if (submitImmediately) {
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form
      action={uploadGroupSubmissionAction}
      className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
      encType="multipart/form-data"
      ref={formRef}
    >
      <input name="sessionId" type="hidden" value={sessionId} />
      <input name="groupId" type="hidden" value={groupId} />

      <div className="grid gap-2">
        <div className="text-sm text-[color:var(--app-fg-muted)]">
          <p className="font-medium text-[color:var(--app-fg)]">Upload group work</p>
          <p>Drop a file here or click to choose one for {groupName}.</p>
          {submittedAt ? (
            <p className="mt-1 text-xs text-[color:var(--app-fg-muted)]">
              Uploaded on {submittedAt}
            </p>
          ) : null}
        </div>

        <label
          className={`grid cursor-pointer gap-2 rounded-xl border border-dashed px-4 py-4 text-sm transition ${
            isDragging
              ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
              : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] hover:border-[color:var(--app-accent)]'
          }`}
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files[0] ?? null;
            syncFile(file, true);
          }}
        >
          <span className="font-medium">
            {selectedFileName ?? fileName ?? 'Drop a file or click to choose'}
          </span>
          <span className="text-[color:var(--app-fg-muted)]">
            One file per group. Drag and drop is supported.
          </span>
          <input
            ref={inputRef}
            className="sr-only"
            id={inputId}
            name="file"
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              syncFile(file, false);
            }}
          />
        </label>

        {selectedFileName ? (
          <p className="text-xs text-[color:var(--app-fg-muted)]">Selected file: {selectedFileName}</p>
        ) : null}
      </div>

      <div className="flex items-end">
        <button
          className="ui-button ui-button-primary"
          type="submit"
        >
          Upload file
        </button>
      </div>
    </form>
  );
}
