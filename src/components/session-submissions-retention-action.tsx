'use client';

import { useEffect, useMemo, useState } from 'react';

import { AppModal, useInteractionFeedback } from '@/components/app-interaction-feedback';
import { useUiLanguage } from '@/components/ui-language-toggle';
import { getUiText, type UiLanguage } from '@/lib/ui-language';

type SessionSubmissionSummary = {
  createdAt: string;
  fileName: string;
  groupId: string;
  groupName: string;
  submittedAt: string | null;
};

type SessionSubmissionsRetentionActionProps = {
  latestExpiryAt: string;
  sessionId: string;
  sessionTitle: string;
  submissions: SessionSubmissionSummary[];
};

function getGroupSortKey(groupName: string) {
  const match = /^Group\s+(\d+)$/i.exec(groupName.trim());
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function getDeletionDate(submission: SessionSubmissionSummary) {
  const retentionStart = submission.submittedAt ?? submission.createdAt;
  return new Date(new Date(retentionStart).getTime() + 10 * 24 * 60 * 60 * 1000);
}

function formatRetentionDateTime(value: string | Date, language: UiLanguage) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';

  return date.toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  });
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
    throw new Error('The files could not be downloaded.');
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

function DownloadAction({
  downloadName,
  href,
  label,
  pendingLabel
}: {
  downloadName: string;
  href: string;
  label: string;
  pendingLabel: string;
}) {
  const [pending, setPending] = useState(false);
  const { runPending } = useInteractionFeedback();

  return (
    <button
      aria-busy={pending || undefined}
      className="ui-button ui-button-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      onClick={async () => {
        if (pending) {
          return;
        }

        setPending(true);

        try {
          await runPending(pendingLabel, async () => {
            await downloadFile(href, downloadName);
          });
        } finally {
          setPending(false);
        }
      }}
      type="button"
    >
      {label}
    </button>
  );
}

function SessionSubmissionsModal({
  latestExpiryAt,
  onClose,
  sessionId,
  sessionTitle,
  submissions
}: SessionSubmissionsRetentionActionProps & { onClose: () => void }) {
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).sessionsHub;
  const shared = getUiText(uiLanguage).shared;
  const sortedSubmissions = useMemo(
    () =>
      [...submissions].sort((left, right) => {
        const leftOrder = getGroupSortKey(left.groupName);
        const rightOrder = getGroupSortKey(right.groupName);
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.groupName.localeCompare(right.groupName, 'en', { sensitivity: 'base' });
      }),
    [submissions]
  );
  const latestExpiryLabel = formatRetentionDateTime(latestExpiryAt, uiLanguage);

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
        <DownloadAction
          downloadName={`${sessionTitle}-student-work.zip`}
          href={`/api/sessions/${sessionId}/submissions/archive`}
          label={t.downloadAllFiles}
          pendingLabel={t.downloadingAllFiles}
        />
      }
      headerLabel={t.studentWork}
      onClose={onClose}
      open
      title={sessionTitle}
      widthClassName="w-[min(64rem,calc(100vw-2rem))]"
    >
      <div className="grid gap-4">
        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--app-fg-muted)]">
            {t.studentWork}
          </p>
          <p className="mt-1 text-sm text-[color:var(--app-fg-muted)]">
            {t.latestExpiry.replace('{date}', latestExpiryLabel)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedSubmissions.map((submission) => {
            const deletionDate = getDeletionDate(submission);

            return (
              <article
                key={submission.groupId}
                className="grid gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[color:var(--app-fg)]">{submission.groupName}</p>
                  <p className="break-words text-sm text-[color:var(--app-fg-muted)]">
                    {submission.fileName}
                  </p>
                </div>

                <div className="space-y-1 text-xs text-[color:var(--app-fg-muted)]">
                  <p>{t.deletesOn.replace('{date}', formatRetentionDateTime(deletionDate, uiLanguage))}</p>
                  {submission.submittedAt ? (
                    <p>
                      {t.uploadedOn.replace(
                        '{date}',
                        formatRetentionDateTime(submission.submittedAt, uiLanguage)
                      )}
                    </p>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <DownloadAction
                    downloadName={submission.fileName}
                    href={`/api/sessions/${sessionId}/submissions/${submission.groupId}`}
                    label={shared.download}
                    pendingLabel={t.downloadingFile.replace('{groupName}', submission.groupName)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AppModal>
  );
}

export function SessionSubmissionsRetentionAction(props: SessionSubmissionsRetentionActionProps) {
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).sessionsHub;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="ui-chip ui-chip-warning whitespace-normal text-left leading-5 transition hover:brightness-95"
        onClick={() => setOpen(true)}
        type="button"
      >
        {t.latestExpiry.replace('{date}', formatRetentionDateTime(props.latestExpiryAt, uiLanguage))}
      </button>

      {open ? <SessionSubmissionsModal {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
