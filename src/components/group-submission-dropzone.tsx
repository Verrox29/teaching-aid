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
      className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
      encType="multipart/form-data"
      ref={formRef}
    >
      <input name="sessionId" type="hidden" value={sessionId} />
      <input name="groupId" type="hidden" value={groupId} />

      <div className="grid gap-2">
        <div className="text-sm text-slate-600">
          <p className="font-medium text-slate-900">Upload group work</p>
          <p>Drop a file here or click to choose one for {groupName}.</p>
          {submittedAt ? (
            <p className="mt-1 text-xs text-slate-500">
              Uploaded on {submittedAt}
            </p>
          ) : null}
        </div>

        <label
          className={`grid cursor-pointer gap-2 rounded-lg border border-dashed px-4 py-4 text-sm transition ${
            isDragging ? 'border-slate-500 bg-white' : 'border-slate-300 bg-white hover:border-slate-400'
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
          <span className="font-medium text-slate-900">
            {selectedFileName ?? fileName ?? 'Drop a file or click to choose'}
          </span>
          <span className="text-slate-500">
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
          <p className="text-xs text-slate-500">Selected file: {selectedFileName}</p>
        ) : null}
      </div>

      <div className="flex items-end">
        <button
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          type="submit"
        >
          Upload file
        </button>
      </div>
    </form>
  );
}
