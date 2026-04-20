'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppModal, useInteractionFeedback } from '@/components/app-interaction-feedback';
import { getUiText } from '@/lib/ui-language';
import { useUiLanguage } from '@/components/ui-language-toggle';

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
  const { uiLanguage } = useUiLanguage();
  const t = getUiText(uiLanguage).randomizeOrder;
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const pendingReleaseRef = useRef<null | (() => void)>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewGroups, setPreviewGroups] = useState(groups);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const { beginPending } = useInteractionFeedback();

  useEffect(() => {
    if (!isOpen || isRandomizing || isSaving) {
      return;
    }

    setPreviewGroups(groups);
  }, [groups, isOpen, isRandomizing, isSaving]);

  useEffect(
    () => () => {
      pendingReleaseRef.current?.();
      pendingReleaseRef.current = null;

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
    setStatus(t.saving);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/order/randomize`, {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST'
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? t.saving);
      }

      setPreviewGroups(payload.groups.map((group: { groupId: string; groupName: string }) => ({
        groupId: group.groupId,
        groupName: group.groupName
      })));
      setStatus(t.saved);
      onRandomized?.(payload.groups);

      if (!onRandomized) {
        router.refresh();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t.saving);
      setStatus('');
    } finally {
      setIsSaving(false);
      setIsRandomizing(false);
      pendingReleaseRef.current?.();
      pendingReleaseRef.current = null;
    }
  }

  function startRandomization() {
    if (disabled || isRandomizing || isSaving || groups.length === 0) {
      return;
    }

    setError('');
    setStatus(t.shuffling);
    setIsOpen(true);
    setIsRandomizing(true);
    pendingReleaseRef.current?.();
    pendingReleaseRef.current = beginPending(t.randomizingOrder);
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

  return (
    <>
      <button
        className="ui-button ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || isRandomizing || isSaving || groups.length === 0}
        onClick={startRandomization}
        type="button"
      >
        {isRandomizing || isSaving ? t.randomizingOrder : t.button}
      </button>

      <AppModal
        headerLabel={t.presentationOrder}
        onClose={closeModal}
        open={isOpen}
        title={t.randomizingGroups}
        widthClassName="w-[min(42rem,calc(100vw-2rem))]"
      >
        <div className="mt-4 grid gap-4">
          <p className="text-sm text-[color:var(--app-fg-muted)]">{t.shuffling}</p>

          <div className="grid gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{status || t.working}</span>
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
      </AppModal>
    </>
  );
}
