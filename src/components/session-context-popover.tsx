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
        <div className="absolute right-0 top-full z-30 mt-3 w-[min(36rem,calc(100vw-2rem))] rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-lg">
          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['Programme', metadata.programme],
                ['Class', metadata.className],
                ['Subject', metadata.subject],
                ['Season', metadata.season],
                ['Professor', metadata.professorName],
                ['Presentation date', metadata.sessionDate]
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-sm">
                  <p className="ui-section-title">{label}</p>
                  <p className="mt-2 font-medium">{value || 'Not set'}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-2">
              <p className="ui-section-title">Group roster</p>
              <div className="grid gap-2 max-h-72 overflow-auto pr-1">
                {roster.map((group) => (
                  <div
                    key={group.groupId}
                    className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{group.groupName}</span>
                      <span className="ui-chip px-2 py-1">{group.members.length} students</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--app-fg-muted)]">
                      {group.members.map((member) => (
                        <span
                          key={member.id}
                          className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1"
                        >
                          {member.firstName} {member.lastName}
                        </span>
                      ))}
                    </div>
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
