'use client';

import { useState } from 'react';

import { useInteractionFeedback } from '@/components/app-interaction-feedback';

type ExportDownloadButtonProps = {
  downloadName: string;
  disabled?: boolean;
  href: string;
  label: string;
  variant?: 'primary' | 'secondary';
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

function readFilename(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  const quotedMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  const value = utf8Match?.[1] ?? quotedMatch?.[1];

  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function downloadFile(href: string, fallbackName: string) {
  const response = await fetch(href, {
    credentials: 'same-origin'
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { errors?: string[]; message?: string };
      const message = payload.errors?.join(' ') ?? payload.message ?? 'The export could not be generated.';
      throw new Error(message);
    }

    throw new Error('The export could not be generated.');
  }

  const blob = await response.blob();
  const resolvedName = readFilename(response.headers.get('content-disposition')) ?? fallbackName;
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  try {
    anchor.href = blobUrl;
    anchor.download = resolvedName;
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
  }
}

export function ExportDownloadButton({
  downloadName,
  disabled = false,
  href,
  label,
  variant = 'secondary'
}: Readonly<ExportDownloadButtonProps>) {
  const [pending, setPending] = useState(false);
  const { runPending } = useInteractionFeedback();

  const className = [
    'ui-button min-w-[14rem] flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-60',
    variant === 'primary' ? 'ui-button-primary' : 'ui-button-secondary'
  ].join(' ');

  if (disabled) {
    return (
      <span aria-disabled="true" className={`${className} cursor-not-allowed`}>
        {label}
      </span>
    );
  }

  return (
    <a
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      className={className}
      href={pending ? undefined : href}
      onClick={async (event) => {
        event.preventDefault();

        if (pending) {
          return;
        }

        setPending(true);

        try {
          await runPending(`Downloading ${label}...`, async () => {
            await downloadFile(href, downloadName);
          });
        } finally {
          setPending(false);
        }
      }}
      tabIndex={pending ? -1 : undefined}
    >
      {pending ? <Spinner /> : null}
      <span>{label}</span>
    </a>
  );
}
