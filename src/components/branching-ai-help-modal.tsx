'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { AppModal } from '@/components/app-interaction-feedback';

function HelpDialogSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
      <p className="ui-section-title">{title}</p>
      <div className="mt-2 space-y-2 text-sm leading-6 text-[color:var(--app-fg-muted)]">
        {children}
      </div>
    </section>
  );
}

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

export function BranchingAiHelpModal() {
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

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="ui-button ui-button-secondary"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        Help
        <ChevronIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AppModal
        headerLabel="Branching AI help"
        onClose={() => setOpen(false)}
        open={open}
        title="Setup guide"
        widthClassName="w-[min(56rem,calc(100vw-2rem))]"
      >
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <HelpDialogSection title="What Branching AI is for">
            <p>
              This connects the app to an external AI provider used by AI-assisted
              evaluation functions.
            </p>
          </HelpDialogSection>

          <HelpDialogSection title="What you need before starting">
            <ul className="list-disc space-y-1 pl-5">
              <li>A provider account</li>
              <li>An API key</li>
              <li>A model or deployment name</li>
              <li>A base URL if your provider requires one</li>
            </ul>
          </HelpDialogSection>

          <HelpDialogSection title="Step-by-step setup">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open Branching AI in admin settings.</li>
              <li>Choose the provider.</li>
              <li>Enter the endpoint if required.</li>
              <li>Enter the model or deployment name.</li>
              <li>Enter the API key.</li>
              <li>Save the configuration.</li>
              <li>Click Test connection.</li>
              <li>Confirm the Verified status.</li>
              <li>Enable Branching AI.</li>
            </ol>
          </HelpDialogSection>

          <HelpDialogSection title="Field explanations">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Provider</strong>: the AI family this setup talks to.
              </li>
              <li>
                <strong>API base URL</strong>: the provider endpoint to call.
              </li>
              <li>
                <strong>Model / deployment</strong>: the exact model name to use.
              </li>
              <li>
                <strong>API key</strong>: the secret credential used to authenticate.
              </li>
              <li>
                <strong>Timeout</strong>: how long the app waits before failing.
              </li>
              <li>
                <strong>Verification status</strong>: whether the last saved config was
                tested successfully.
              </li>
            </ul>
          </HelpDialogSection>

          <HelpDialogSection title="Prompt templates">
            <p>
              Each core AI function has its own editable prompt template. Keep each prompt
              aligned with its intended job. Connection settings and prompts are managed
              separately.
            </p>
          </HelpDialogSection>

          <HelpDialogSection title="Common errors">
            <ul className="list-disc space-y-1 pl-5">
              <li>Invalid API key</li>
              <li>Wrong endpoint</li>
              <li>Wrong model name</li>
              <li>Timeout or network issue</li>
              <li>Insufficient permissions</li>
            </ul>
          </HelpDialogSection>

          <HelpDialogSection title="Security notes">
            <p>
              API keys are stored securely. Saved keys are not displayed again. Rotate the
              key if exposure is suspected.
            </p>
          </HelpDialogSection>

          <HelpDialogSection title="What Test connection checks">
            <ul className="list-disc space-y-1 pl-5">
              <li>Authentication works</li>
              <li>The provider endpoint is reachable</li>
              <li>The selected model or deployment is usable</li>
            </ul>
          </HelpDialogSection>
        </div>
      </AppModal>
    </>
  );
}
