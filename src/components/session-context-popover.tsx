'use client';

import { useEffect, useRef, useState } from 'react';
import { AppModal } from '@/components/app-interaction-feedback';
import { getUiText } from '@/lib/ui-language';
import { useUiLanguage } from '@/components/ui-language-toggle';

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
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).contextPopover;
  const metadataEntries = [
    [getUiText(uiLanguage).shared.programme, metadata.programme],
    [getUiText(uiLanguage).sessionAdmin.class, metadata.className],
    [getUiText(uiLanguage).sessionAdmin.subject, metadata.subject],
    [getUiText(uiLanguage).sessionAdmin.intake, metadata.season],
    [getUiText(uiLanguage).sessionAdmin.professor, metadata.professorName],
    [getUiText(uiLanguage).sessionAdmin.presentationDate, metadata.sessionDate]
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
        {t.label}
        <ChevronIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AppModal
        headerLabel={t.label}
        onClose={() => setOpen(false)}
        open={open}
        title={t.metadata}
        widthClassName="w-[min(42rem,calc(100vw-2rem))]"
      >
        <div ref={panelRef} className="mt-4 grid gap-2 sm:grid-cols-2">
          {metadataEntries.map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-sm"
            >
              <p className="ui-section-title">{label}</p>
              <p className="mt-1 font-medium leading-5">{value || getUiText(uiLanguage).shared.notSet}</p>
            </div>
          ))}
        </div>
      </AppModal>
    </>
  );
}
