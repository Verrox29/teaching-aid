'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFormStatus } from 'react-dom';

type PendingEntry = {
  id: string;
  label?: string;
};

type InteractionFeedbackContextValue = {
  beginPending: (label?: string) => () => void;
  runPending: <T>(label: string, task: () => Promise<T> | T) => Promise<T>;
};

type AppModalProps = {
  backLabel?: string;
  children: ReactNode;
  headerActions?: ReactNode;
  headerLabel?: string;
  onBack?: () => void;
  onClose: () => void;
  open: boolean;
  showBackButton?: boolean;
  title: string;
  widthClassName?: string;
};

type PendingFormBridgeProps = {
  label?: string;
};

const InteractionFeedbackContext = createContext<InteractionFeedbackContextValue | null>(null);

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.5 5.5L14.5 14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M14.5 5.5L5.5 14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.25 4.75L3.75 10L8.25 15.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path
        d="M16.25 10H4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function PendingOverlay({ entries }: { entries: PendingEntry[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || entries.length === 0) {
    return null;
  }

  const label = entries[entries.length - 1]?.label ?? 'Working...';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[color:rgba(17,12,25,0.48)] px-4 backdrop-blur-[2px]">
      <div
        aria-live="polite"
        className="flex flex-col items-center gap-4 rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-7 py-6 text-center text-sm font-medium text-[color:var(--app-fg)] shadow-xl"
        role="status"
      >
        <span
          aria-hidden="true"
          className="h-12 w-12 animate-spin rounded-full border-[3px] border-[color:var(--app-accent)] border-t-transparent"
        />
        <div className="space-y-1">
          <p className="text-base font-semibold">{label}</p>
          <p className="text-xs font-normal text-[color:var(--app-fg-muted)]">Please wait while the app finishes this action.</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AppInteractionFeedbackProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const nextIdRef = useRef(0);

  const beginPending = useCallback((label?: string) => {
    const id = String(++nextIdRef.current);
    setEntries((current) => [...current, { id, label }]);

    return () => {
      setEntries((current) => current.filter((entry) => entry.id !== id));
    };
  }, []);

  const runPending = useCallback(async <T,>(label: string, task: () => Promise<T> | T) => {
    const endPending = beginPending(label);

    try {
      return await task();
    } finally {
      endPending();
    }
  }, [beginPending]);

  const value = useMemo<InteractionFeedbackContextValue>(
    () => ({
      beginPending,
      runPending
    }),
    [beginPending, runPending]
  );

  return (
    <InteractionFeedbackContext.Provider value={value}>
      {children}
      <PendingOverlay entries={entries} />
    </InteractionFeedbackContext.Provider>
  );
}

export function useInteractionFeedback() {
  const value = useContext(InteractionFeedbackContext);

  if (!value) {
    throw new Error('useInteractionFeedback must be used within AppInteractionFeedbackProvider');
  }

  return value;
}

export function AppPendingFormBridge({ label }: PendingFormBridgeProps) {
  const { pending } = useFormStatus();
  const { beginPending } = useInteractionFeedback();
  const releaseRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (pending && !releaseRef.current) {
      releaseRef.current = beginPending(label);
      return;
    }

    if (!pending && releaseRef.current) {
      releaseRef.current();
      releaseRef.current = null;
    }
  }, [beginPending, label, pending]);

  useEffect(
    () => () => {
      releaseRef.current?.();
      releaseRef.current = null;
    },
    []
  );

  return null;
}

export function AppModal({
  backLabel,
  children,
  headerActions,
  headerLabel = 'Teacher admin',
  onBack,
  onClose,
  open,
  showBackButton = false,
  title,
  widthClassName = 'w-[min(44rem,calc(100vw-2rem))]'
}: AppModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-[color:rgba(17,12,25,0.38)] backdrop-blur-[2px]" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          aria-modal="true"
          className={`${widthClassName} max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-lg`}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="ui-section-title">{headerLabel}</p>
              <h2 className="text-xl font-semibold">{title}</h2>
            </div>
            <div className="flex items-center gap-2">
              {showBackButton && onBack ? (
                <button
                  aria-label={backLabel ?? 'Back'}
                  className="ui-button ui-button-secondary px-3 py-2 text-sm"
                  onClick={onBack}
                  type="button"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  {backLabel ?? 'Back'}
                </button>
              ) : null}
              {headerActions}
              <button
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-sm font-semibold text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-surface-soft)]"
                onClick={onClose}
                type="button"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
