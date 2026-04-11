'use client';

import { useEffect, useRef, useState } from 'react';

type SessionContextPopoverProps = {
  metadata: {
    className: string;
    professorName: string;
    programme: string;
    season: string;
    sessionDate: string;
    subject: string;
  };
};

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.75 7.5L10 11.75L14.25 7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function SessionContextPopover({ metadata }: SessionContextPopoverProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const metadataEntries = [
    ['Programme', metadata.programme],
    ['Class', metadata.className],
    ['Subject', metadata.subject],
    ['Season', metadata.season],
    ['Professor', metadata.professorName],
    ['Presentation date', metadata.sessionDate]
  ] as const;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="ui-button ui-button-secondary"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        Session context
        <ChevronIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-[color:rgba(17,12,25,0.38)] backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              ref={panelRef}
              aria-modal="true"
              className="w-[min(42rem,calc(100vw-2rem))] rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-lg"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="ui-section-title">Session context</p>
                  <h2 className="text-xl font-semibold">Metadata</h2>
                </div>
                <button
                  className="ui-button ui-button-secondary px-3 py-2 text-sm"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {metadataEntries.map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-sm"
                  >
                    <p className="ui-section-title">{label}</p>
                    <p className="mt-1 font-medium leading-5">{value || 'Not set'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
