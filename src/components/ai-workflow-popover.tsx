'use client';

import { useEffect, useState } from 'react';
import { AppModal } from '@/components/app-interaction-feedback';

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

      <AppModal
        headerLabel="AI workflow"
        onClose={() => setOpen(false)}
        open={open}
        title="Choose an action"
        widthClassName="w-[min(26rem,calc(100vw-2rem))]"
      >
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
      </AppModal>
    </>
  );
}
