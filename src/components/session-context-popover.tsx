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
  roster: Array<{
    groupId: string;
    groupName: string;
    members: Array<{
      firstName: string;
      id: string;
      lastName: string;
      schoolEmail: string;
    }>;
  }>;
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

export function SessionContextPopover({ metadata, roster }: SessionContextPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const metadataEntries = [
    ['Programme', metadata.programme],
    ['Class', metadata.className],
    ['Subject', metadata.subject],
    ['Season', metadata.season],
    ['Professor', metadata.professorName],
    ['Presentation date', metadata.sessionDate]
  ] as const;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
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
        <div className="absolute right-0 top-full z-30 mt-3 w-[min(34rem,calc(100vw-1rem))] rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 shadow-lg">
          <div className="grid gap-3 max-h-[min(70vh,42rem)] overflow-auto pr-1">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {metadataEntries.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3"
                >
                  <dt className="ui-section-title">{label}</dt>
                  <dd className="mt-1 font-medium leading-5">{value || 'Not set'}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="ui-section-title">Group roster</p>
                <span className="ui-chip px-2 py-1">{roster.length} groups</span>
              </div>
              <div className="grid gap-1.5">
                {roster.map((group) => (
                  <div
                    key={group.groupId}
                    className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[color:var(--app-fg)]">{group.groupName}</span>
                      <span className="ui-chip px-2 py-1">{group.members.length}</span>
                    </div>
                    <p className="mt-1 leading-5 text-[color:var(--app-fg-muted)]">
                      {group.members.map((member) => `${member.firstName} ${member.lastName}`).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
