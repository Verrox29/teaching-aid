'use client';

import { useId, useState, type ReactNode } from 'react';

type CollapsiblePanelProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  description?: ReactNode;
  eyebrow?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  title: ReactNode;
  titleLabel?: string;
  titleClassName?: string;
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

export function CollapsiblePanel({
  actions,
  children,
  className,
  contentClassName,
  defaultOpen = true,
  description,
  eyebrow,
  onOpenChange,
  open,
  title,
  titleLabel,
  titleClassName = 'text-lg font-semibold'
}: CollapsiblePanelProps) {
  const contentId = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  function toggleOpen() {
    const nextOpen = !isOpen;

    if (isControlled) {
      onOpenChange?.(nextOpen);
      return;
    }

    setInternalOpen(nextOpen);
  }

  return (
    <section className={`ui-panel grid gap-4 p-5 ${className ?? ''}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          {eyebrow ? <p className="ui-section-title">{eyebrow}</p> : null}
          <h2 className={titleClassName}>{title}</h2>
          {description ? <div className="text-sm text-[color:var(--app-fg-muted)]">{description}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          {actions}
          <button
            aria-controls={contentId}
            aria-expanded={isOpen}
            aria-label={
              isOpen
                ? `Collapse ${titleLabel ?? (typeof title === 'string' ? title : 'panel')}`
                : `Expand ${titleLabel ?? (typeof title === 'string' ? title : 'panel')}`
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-surface-soft)]"
            onClick={toggleOpen}
            type="button"
          >
            <ChevronIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen ? (
        <div id={contentId} className={`grid gap-4 ${contentClassName ?? ''}`.trim()}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
