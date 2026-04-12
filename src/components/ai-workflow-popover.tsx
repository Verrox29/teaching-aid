'use client';

import { useEffect, useState } from 'react';

type AiWorkflowPopoverProps = {
  canGenerateQuestions: boolean;
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

export function AiWorkflowPopover({ canGenerateQuestions }: AiWorkflowPopoverProps) {
  const [open, setOpen] = useState(false);

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

  function dispatch(mode: 'grading' | 'questions') {
    window.dispatchEvent(new CustomEvent('evaluation-ai-workflow', { detail: { mode } }));
    setOpen(false);
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="ui-button ui-button-secondary"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        AI workflow
        <ChevronIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-[color:rgba(17,12,25,0.38)] backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              aria-modal="true"
              className="w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-lg"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="ui-section-title">AI workflow</p>
                  <h2 className="text-xl font-semibold">Choose an action</h2>
                </div>
                <button
                  className="ui-button ui-button-secondary px-3 py-2 text-sm"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  className="ui-button ui-button-secondary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canGenerateQuestions}
                  onClick={() => dispatch('questions')}
                  type="button"
                  title={
                    canGenerateQuestions
                      ? 'Generate challenge questions from uploaded work.'
                      : 'Upload student work before generating questions.'
                  }
                >
                  Generate questions
                </button>
                <button
                  className="ui-button ui-button-primary justify-center"
                  onClick={() => dispatch('grading')}
                  type="button"
                >
                  Generate feedback
                </button>
              </div>

              {!canGenerateQuestions ? (
                <p className="mt-3 text-sm text-[color:var(--app-fg-muted)]">
                  Questions stay disabled until at least one submission has been uploaded.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
