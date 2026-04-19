'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type PresentationOrderGroup = {
  groupId: string;
  groupName: string;
};

type RandomizeOrderButtonProps = {
  disabled?: boolean;
  groups: PresentationOrderGroup[];
  onRandomized?: (groups: Array<{ groupId: string; presentationOrder: number }>) => void;
  sessionId: string;
};

function shuffle(values: PresentationOrderGroup[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function RandomizeOrderButton({
  disabled,
  groups,
  onRandomized,
  sessionId
}: RandomizeOrderButtonProps) {
  const router = useRouter();
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewGroups, setPreviewGroups] = useState(groups);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || isRandomizing || isSaving) {
      return;
    }

    setPreviewGroups(groups);
  }, [groups, isOpen, isRandomizing, isSaving]);

  useEffect(
    () => () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  async function persistRandomizedOrder() {
    setIsSaving(true);
    setStatus('Saving the final order...');

    try {
      const response = await fetch(`/api/sessions/${sessionId}/order/randomize`, {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST'
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not randomize the presentation order.');
      }

      setPreviewGroups(payload.groups.map((group: { groupId: string; groupName: string }) => ({
        groupId: group.groupId,
        groupName: group.groupName
      })));
      setStatus('Presentation order saved. You can close this window.');
      onRandomized?.(payload.groups);

      if (!onRandomized) {
        router.refresh();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not randomize the presentation order.');
      setStatus('');
    } finally {
      setIsSaving(false);
      setIsRandomizing(false);
    }
  }

  function startRandomization() {
    if (disabled || isRandomizing || isSaving || groups.length === 0) {
      return;
    }

    setError('');
    setStatus('Shuffling the presentation order...');
    setIsOpen(true);
    setIsRandomizing(true);
    setPreviewGroups(shuffle(groups));

    intervalRef.current = window.setInterval(() => {
      setPreviewGroups(shuffle(groups));
    }, 90);

    timeoutRef.current = window.setTimeout(() => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      void persistRandomizedOrder();
    }, 900);
  }

  function closeModal() {
    if (isRandomizing || isSaving) {
      return;
    }

    setIsOpen(false);
    setError('');
  }

  const closeDisabled = isRandomizing || isSaving;

  return (
    <>
      <button
        className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || isRandomizing || isSaving || groups.length === 0}
        onClick={startRandomization}
        type="button"
      >
        {isRandomizing || isSaving ? 'Randomizing order...' : 'Randomize order'}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 bg-[color:rgba(17,12,25,0.38)] backdrop-blur-[2px]"
          onClick={closeModal}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              aria-modal="true"
              className="w-[min(42rem,calc(100vw-2rem))] rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-lg"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="ui-section-title">Presentation order</p>
                  <h2 className="text-xl font-semibold">Randomizing groups</h2>
                </div>
                <button
                  className="ui-button ui-button-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={closeDisabled}
                  onClick={closeModal}
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-4">
                <p className="text-sm text-[color:var(--app-fg-muted)]">
                  The order is being shuffled and saved. Keep this window open until the animation finishes.
                </p>

                <div className="grid gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{status || 'Working...'}</span>
                    {error ? <span className="text-[color:var(--app-danger)]">{error}</span> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {previewGroups.map((group, index) => (
                      <span
                        key={`${group.groupId}-${index}`}
                        className="ui-chip px-3 py-1.5 transition-transform duration-150 ease-out"
                        style={{
                          transform: isRandomizing ? `translateY(${(index % 2) * 2}px)` : 'translateY(0)'
                        }}
                      >
                        {group.groupName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
