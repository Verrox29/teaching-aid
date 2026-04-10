'use client';

import { useEffect, useRef, useState } from 'react';

import { randomizePresentationOrderAction } from '@/app/sessions/[sessionId]/order/actions';

type RandomizeOrderButtonProps = {
  disabled?: boolean;
  groupNames: string[];
  sessionId: string;
};

function shuffle(values: string[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function RandomizeOrderButton({
  disabled,
  groupNames,
  sessionId
}: RandomizeOrderButtonProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [previewNames, setPreviewNames] = useState(groupNames);

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

  function startRandomization() {
    if (disabled || isRandomizing || groupNames.length === 0) {
      return;
    }

    setIsRandomizing(true);
    setPreviewNames(shuffle(groupNames));

    intervalRef.current = window.setInterval(() => {
      setPreviewNames(shuffle(groupNames));
    }, 90);

    timeoutRef.current = window.setTimeout(() => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      setIsRandomizing(false);
      formRef.current?.requestSubmit();
    }, 900);
  }

  return (
    <div className="grid gap-2">
      <form action={randomizePresentationOrderAction} ref={formRef}>
        <input name="sessionId" type="hidden" value={sessionId} />
        <button
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={disabled || isRandomizing || groupNames.length === 0}
          type="button"
          onClick={startRandomization}
        >
          {isRandomizing ? 'Randomizing order...' : 'Randomize order'}
        </button>
      </form>

      {isRandomizing ? (
        <div className="flex flex-wrap gap-2">
          {previewNames.map((name, index) => (
            <span
              key={`${name}-${index}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
            >
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
