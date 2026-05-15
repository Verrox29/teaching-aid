'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useInteractionFeedback } from '@/components/app-interaction-feedback';
import { BranchingAiHelpModal } from '@/components/branching-ai-help-modal';
import { shouldShowAdminDiagnostics } from '@/lib/admin-diagnostics';
import type {
  BranchingAiAdminView,
  BranchingAiChallengeQuestionValidationSettings,
  BranchingAiPromptTemplateView,
  BranchingAiProvider,
  BranchingAiVerificationStatus
} from '@/lib/ai/types';
import { BRANCHING_AI_PROMPT_DEFAULTS, BRANCHING_AI_PROMPT_KEYS } from '@/lib/ai/prompt-defaults';

type BranchingAiAccessState = {
  configured: boolean;
  unlocked: boolean;
};

type BranchingAiSettingsPanelProps = {
  accessState: BranchingAiAccessState;
  initialView: BranchingAiAdminView | null;
};

type ConnectionDraft = {
  apiBaseUrl: string;
  enabled: boolean;
  model: string;
  provider: BranchingAiProvider;
  timeoutMs: string;
};

type ValidationDraft = {
  maxQuestionLength: string;
  minAcceptedQuestions: string;
  minQuestionWordCount: string;
  maxAcceptedQuestions: string;
  rejectDuplicateQuestions: boolean;
  rejectIndirectFrenchWording: boolean;
  requireFrenchVous: boolean;
  requireReadableLetters: boolean;
};

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function statusLabel(status: BranchingAiVerificationStatus) {
  return {
    disabled: 'Disabled',
    failed: 'Failed',
    not_configured: 'Not configured',
    saved: 'Saved',
    verified: 'Verified'
  }[status];
}

function statusTone(status: BranchingAiVerificationStatus) {
  return {
    disabled: 'ui-chip',
    failed: 'ui-chip ui-chip-danger',
    not_configured: 'ui-chip',
    saved: 'ui-chip ui-chip-accent',
    verified: 'ui-chip ui-chip-success'
  }[status];
}

function clonePromptDrafts(prompts: BranchingAiPromptTemplateView[]) {
  return Object.fromEntries(prompts.map((prompt) => [prompt.promptKey, prompt.template])) as Record<
    BranchingAiPromptTemplateView['promptKey'],
    string
  >;
}

function cloneValidationDraft(
  validation: BranchingAiChallengeQuestionValidationSettings | null | undefined
): ValidationDraft {
  return {
    maxQuestionLength: String(validation?.maxQuestionLength ?? 180),
    minAcceptedQuestions: String(validation?.minAcceptedQuestions ?? 2),
    minQuestionWordCount: String(validation?.minQuestionWordCount ?? 3),
    maxAcceptedQuestions: String(validation?.maxAcceptedQuestions ?? 3),
    rejectDuplicateQuestions: validation?.rejectDuplicateQuestions ?? true,
    rejectIndirectFrenchWording: validation?.rejectIndirectFrenchWording ?? true,
    requireFrenchVous: validation?.requireFrenchVous ?? true,
    requireReadableLetters: validation?.requireReadableLetters ?? true
  };
}

export function BranchingAiSettingsPanel({
  accessState,
  initialView
}: BranchingAiSettingsPanelProps) {
  const showAdminDiagnostics = shouldShowAdminDiagnostics();
  const router = useRouter();
  const { runPending } = useInteractionFeedback();
  const [view, setView] = useState<BranchingAiAdminView | null>(initialView);
  const [unlockToken, setUnlockToken] = useState('');
  const [unlockStatus, setUnlockStatus] = useState('');
  const [message, setMessage] = useState('');
  const [busyAction, setBusyAction] = useState<
    'connection-save' | 'connection-test' | 'prompts-save' | 'validation-save' | 'unlock' | null
  >(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>(() => ({
    apiBaseUrl: initialView?.settings.apiBaseUrl ?? '',
    enabled: initialView?.settings.enabled ?? false,
    model: initialView?.settings.model ?? '',
    provider: initialView?.settings.provider ?? 'openai-compatible',
    timeoutMs: String(initialView?.settings.timeoutMs ?? 15000)
  }));
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>(() =>
    initialView ? clonePromptDrafts(initialView.prompts) : {}
  );
  const [validationDraft, setValidationDraft] = useState<ValidationDraft>(() =>
    cloneValidationDraft(initialView?.settings.challengeQuestionValidationSettings)
  );

  useEffect(() => {
    setView(initialView);
    setConnectionDraft({
      apiBaseUrl: initialView?.settings.apiBaseUrl ?? '',
      enabled: initialView?.settings.enabled ?? false,
      model: initialView?.settings.model ?? '',
      provider: initialView?.settings.provider ?? 'openai-compatible',
      timeoutMs: String(initialView?.settings.timeoutMs ?? 15000)
    });
    setApiKeyDraft('');
    setPromptDrafts(initialView ? clonePromptDrafts(initialView.prompts) : {});
    setValidationDraft(cloneValidationDraft(initialView?.settings.challengeQuestionValidationSettings));
    setMessage('');
  }, [initialView]);

  const promptList = useMemo(
    () =>
      BRANCHING_AI_PROMPT_KEYS.map((promptKey) => ({
        defaultTemplate: BRANCHING_AI_PROMPT_DEFAULTS[promptKey].template,
        key: promptKey,
        prompt: view?.prompts.find((entry) => entry.promptKey === promptKey) ?? null
      })),
    [view]
  );

  async function unlockAdminAccess() {
    setBusyAction('unlock');
    setUnlockStatus('');
    await runPending('Unlocking Branching AI...', async () => {
      const response = await fetch('/api/admin/branching-ai/unlock', {
        body: JSON.stringify({ token: unlockToken }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? 'Could not unlock Branching AI settings.');
      }
      setUnlockToken('');
      setUnlockStatus('Unlocked.');
      router.refresh();
    });
  }

  async function saveConnection() {
    setBusyAction('connection-save');
    setMessage('');

    const payload = {
      apiBaseUrl: connectionDraft.apiBaseUrl.trim() || null,
      apiKey: apiKeyDraft.trim() || null,
      enabled: connectionDraft.enabled,
      model: connectionDraft.model.trim() || null,
      provider: connectionDraft.provider,
      timeoutMs: Number.parseInt(connectionDraft.timeoutMs, 10)
    };

    await runPending('Saving Branching AI connection...', async () => {
      const response = await fetch('/api/admin/branching-ai', {
        body: JSON.stringify({ connection: payload }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'PATCH'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? 'Could not save Branching AI connection settings.');
      }

      setView(result.view);
      setApiKeyDraft('');
      setMessage('Connection settings saved.');
    });
  }

  async function testConnection() {
    setBusyAction('connection-test');
    setMessage('');
    await runPending('Testing Branching AI connection...', async () => {
      const response = await fetch('/api/admin/branching-ai/test', {
        method: 'POST'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? 'Could not test Branching AI connection.');
      }
      setView(result.view);
      setMessage('Connection verified successfully.');
    });
  }

  async function savePrompts() {
    setBusyAction('prompts-save');
    setMessage('');

    const prompts = BRANCHING_AI_PROMPT_KEYS.map((promptKey) => ({
      promptKey,
      template: promptDrafts[promptKey] ?? ''
    }));

    await runPending('Saving Branching AI prompts...', async () => {
      const response = await fetch('/api/admin/branching-ai', {
        body: JSON.stringify({ prompts }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'PATCH'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? 'Could not save Branching AI prompts.');
      }

      setView(result.view);
      setMessage('Prompt templates saved.');
    });
  }

  async function saveValidationSettings() {
    setBusyAction('validation-save');
    setMessage('');

    const payload = {
      maxQuestionLength: Number.parseInt(validationDraft.maxQuestionLength, 10),
      maxAcceptedQuestions: Number.parseInt(validationDraft.maxAcceptedQuestions, 10),
      minAcceptedQuestions: Number.parseInt(validationDraft.minAcceptedQuestions, 10),
      minQuestionWordCount: Number.parseInt(validationDraft.minQuestionWordCount, 10),
      rejectDuplicateQuestions: validationDraft.rejectDuplicateQuestions,
      rejectIndirectFrenchWording: validationDraft.rejectIndirectFrenchWording,
      requireFrenchVous: validationDraft.requireFrenchVous,
      requireReadableLetters: validationDraft.requireReadableLetters
    };

    await runPending('Saving Branching AI validation rules...', async () => {
      const response = await fetch('/api/admin/branching-ai', {
        body: JSON.stringify({ challengeQuestionValidation: payload }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'PATCH'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? 'Could not save challenge question validation.');
      }

      setView(result.view);
      setMessage('Challenge question validation saved.');
    });
  }

  function hasConnectionChanges() {
    if (!view) {
      return false;
    }

    return (
      connectionDraft.apiBaseUrl.trim() !== (view.settings.apiBaseUrl ?? '') ||
      connectionDraft.enabled !== view.settings.enabled ||
      connectionDraft.model.trim() !== (view.settings.model ?? '') ||
      connectionDraft.provider !== view.settings.provider ||
      Number.parseInt(connectionDraft.timeoutMs, 10) !== view.settings.timeoutMs ||
      Boolean(apiKeyDraft.trim())
    );
  }

  function hasPromptChanges() {
    if (!view) {
      return false;
    }

    return BRANCHING_AI_PROMPT_KEYS.some(
      (promptKey) => (promptDrafts[promptKey] ?? '') !== (view.prompts.find((entry) => entry.promptKey === promptKey)?.template ?? '')
    );
  }

  function hasValidationChanges() {
    if (!view) {
      return false;
    }

    const current = view.settings.challengeQuestionValidationSettings;
    return (
      validationDraft.maxQuestionLength !== String(current?.maxQuestionLength ?? 180) ||
      validationDraft.minAcceptedQuestions !== String(current?.minAcceptedQuestions ?? 2) ||
      validationDraft.maxAcceptedQuestions !== String(current?.maxAcceptedQuestions ?? 3) ||
      validationDraft.minQuestionWordCount !== String(current?.minQuestionWordCount ?? 3) ||
      validationDraft.rejectDuplicateQuestions !== (current?.rejectDuplicateQuestions ?? true) ||
      validationDraft.rejectIndirectFrenchWording !==
        (current?.rejectIndirectFrenchWording ?? true) ||
      validationDraft.requireFrenchVous !== (current?.requireFrenchVous ?? true) ||
      validationDraft.requireReadableLetters !== (current?.requireReadableLetters ?? true)
    );
  }

  if (!accessState.unlocked) {
    return (
      <section className="ui-panel grid gap-4 p-6">
        <div className="space-y-1">
          <p className="ui-section-title">Branching AI</p>
          <h2 className="text-lg font-semibold">Admin unlock required</h2>
        </div>

        <p className="text-sm text-[color:var(--app-fg-muted)]">
          This secret-bearing surface is locked until an admin token is entered.
        </p>

        {!accessState.configured ? (
          <p className="rounded-2xl border border-[color:var(--app-warning)]/20 bg-[color:var(--app-warning)]/10 px-4 py-3 text-sm text-[color:var(--app-warning)]">
            Set <code>BRANCHING_AI_ADMIN_TOKEN</code> before trying to unlock this section.
          </p>
        ) : null}

        <form
          className="grid gap-3 sm:max-w-xl"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await unlockAdminAccess();
            } catch (error) {
              setUnlockStatus(error instanceof Error ? error.message : 'Could not unlock.');
            } finally {
              setBusyAction(null);
            }
          }}
        >
          <label className="grid gap-2 text-sm font-medium">
            Admin token
            <input
              className="ui-input"
              onChange={(event) => setUnlockToken(event.target.value)}
              value={unlockToken}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button className="ui-button ui-button-primary" type="submit">
              Unlock Branching AI
            </button>
            <p className="text-sm text-[color:var(--app-fg-muted)]">
              {busyAction === 'unlock' ? 'Unlocking...' : unlockStatus || 'Unlock to manage settings.'}
            </p>
          </div>
        </form>
      </section>
    );
  }

  if (!view) {
    return (
      <section className="ui-panel p-6">
        <p className="text-sm text-[color:var(--app-fg-muted)]">
          Branching AI settings could not be loaded.
        </p>
      </section>
    );
  }

  return (
    <section className="ui-panel grid gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="ui-section-title">Branching AI</p>
          <h2 className="text-xl font-semibold">Connection and prompt templates</h2>
          <p className="text-sm text-[color:var(--app-fg-muted)]">
            Manage the global AI provider setup and the three editable prompt templates used later
            by the evaluation workflow.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={statusTone(view.settings.verificationStatus)}>
            {statusLabel(view.settings.verificationStatus)}
          </span>
          <BranchingAiHelpModal />
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-[color:var(--app-success)]/20 bg-[color:var(--app-success)]/10 px-4 py-3 text-sm text-[color:var(--app-success)]">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <div className="grid gap-4">
          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="ui-section-title">Connection</p>
                <h3 className="text-lg font-semibold">Provider settings</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="ui-button ui-button-secondary"
                  disabled={!hasConnectionChanges() || busyAction !== null}
                  onClick={() => {
                    void saveConnection().catch((error) => {
                      setMessage(error instanceof Error ? error.message : 'Could not save settings.');
                    }).finally(() => setBusyAction(null));
                  }}
                  type="button"
                >
                  Save configuration
                </button>
                <button
                  className="ui-button ui-button-primary"
                  disabled={hasConnectionChanges() || busyAction !== null}
                  onClick={() => {
                    void testConnection().catch((error) => {
                      setMessage(error instanceof Error ? error.message : 'Could not test connection.');
                    }).finally(() => setBusyAction(null));
                  }}
                  type="button"
                >
                  Test connection
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Provider
                <select
                  className="ui-input"
                  onChange={(event) =>
                    setConnectionDraft((current) => ({
                      ...current,
                      provider: event.target.value as BranchingAiProvider
                    }))
                  }
                  value={connectionDraft.provider}
                >
                  <option value="openai-compatible">OpenAI-compatible</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium">
                API base URL
                <input
                  className="ui-input"
                  onChange={(event) =>
                    setConnectionDraft((current) => ({
                      ...current,
                      apiBaseUrl: event.target.value
                    }))
                  }
                  placeholder="https://api.example.com"
                  value={connectionDraft.apiBaseUrl}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Model
                <input
                  className="ui-input"
                  onChange={(event) =>
                    setConnectionDraft((current) => ({
                      ...current,
                      model: event.target.value
                    }))
                  }
                  placeholder="gpt-4.1-mini"
                  value={connectionDraft.model}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                API key
                <input
                  className="ui-input"
                  onChange={(event) => setApiKeyDraft(event.target.value)}
                  placeholder={view.hasApiKey ? 'Saved securely' : 'Enter API key'}
                  type="password"
                  value={apiKeyDraft}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Timeout (ms)
                  <input
                    className="ui-input"
                    inputMode="numeric"
                    onChange={(event) =>
                      setConnectionDraft((current) => ({
                        ...current,
                        timeoutMs: event.target.value
                      }))
                    }
                    value={connectionDraft.timeoutMs}
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-3 text-sm font-medium">
                  <input
                    checked={connectionDraft.enabled}
                    onChange={(event) =>
                      setConnectionDraft((current) => ({
                        ...current,
                        enabled: event.target.checked
                      }))
                    }
                    type="checkbox"
                  />
                  Enable Branching AI
                </label>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-[color:var(--app-fg-muted)]">
              <p>Saved: {formatDateTime(view.settings.updatedAt)}</p>
              <p>Last tested: {formatDateTime(view.settings.lastTestedAt)}</p>
              <p>
                Last error: {view.settings.lastTestError?.trim() || 'None'}
              </p>
              {hasConnectionChanges() ? (
                <p className="text-[color:var(--app-warning)]">
                  Connection settings have changed. Save them before testing again.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="ui-section-title">Prompt templates</p>
                <h3 className="text-lg font-semibold">Editable prompts</h3>
              </div>
              <button
                className="ui-button ui-button-primary"
                disabled={!hasPromptChanges() || busyAction !== null}
                onClick={() => {
                  void savePrompts().catch((error) => {
                    setMessage(error instanceof Error ? error.message : 'Could not save prompts.');
                  }).finally(() => setBusyAction(null));
                }}
                type="button"
              >
                Save prompts
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              {promptList.map(({ defaultTemplate, key, prompt }) => {
                const currentTemplate = promptDrafts[key] ?? prompt?.template ?? defaultTemplate;
                const promptMeta = BRANCHING_AI_PROMPT_DEFAULTS[key];

                return (
                  <article
                    key={key}
                    className="rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{promptMeta.title}</p>
                        <p className="text-sm text-[color:var(--app-fg-muted)]">
                          {promptMeta.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="ui-button ui-button-secondary px-3 py-2 text-sm"
                          onClick={() =>
                            setPromptDrafts((current) => ({
                              ...current,
                              [key]: promptMeta.template
                            }))
                          }
                          type="button"
                        >
                          Reset to default
                        </button>
                      </div>
                    </div>

                    <label className="mt-3 grid gap-2 text-sm font-medium">
                      Prompt text
                      <textarea
                        className="ui-textarea min-h-44 font-mono text-sm"
                        onChange={(event) =>
                          setPromptDrafts((current) => ({
                            ...current,
                            [key]: event.target.value
                          }))
                        }
                        value={currentTemplate}
                      />
                    </label>

                    {key === 'generate_challenge_questions' ? (
                      <div className="mt-3 grid gap-4 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--app-fg-muted)]">
                              Validation rules
                            </p>
                            <p className="text-sm text-[color:var(--app-fg-muted)]">
                              These settings control which model-generated challenge questions are
                              accepted at runtime.
                            </p>
                          </div>
                          <button
                            className="ui-button ui-button-secondary px-3 py-2 text-sm"
                            disabled={!hasValidationChanges() || busyAction !== null}
                            onClick={() => {
                              void saveValidationSettings().catch((error) => {
                                setMessage(
                                  error instanceof Error
                                    ? error.message
                                    : 'Could not save validation rules.'
                                );
                              }).finally(() => setBusyAction(null));
                            }}
                            type="button"
                          >
                            Save validation rules
                          </button>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="grid gap-2 text-sm font-medium">
                            Maximum question length
                            <input
                              className="ui-input"
                              inputMode="numeric"
                              min="40"
                              onChange={(event) =>
                                setValidationDraft((current) => ({
                                  ...current,
                                  maxQuestionLength: event.target.value
                                }))
                              }
                              type="number"
                              value={validationDraft.maxQuestionLength}
                            />
                            <span className="text-xs text-[color:var(--app-fg-muted)]">
                              Questions longer than this are rejected.
                            </span>
                          </label>

                          <label className="grid gap-2 text-sm font-medium">
                            Minimum question word count
                            <input
                              className="ui-input"
                              inputMode="numeric"
                              min="1"
                              onChange={(event) =>
                                setValidationDraft((current) => ({
                                  ...current,
                                  minQuestionWordCount: event.target.value
                                }))
                              }
                              type="number"
                              value={validationDraft.minQuestionWordCount}
                            />
                            <span className="text-xs text-[color:var(--app-fg-muted)]">
                              Short fragments are rejected.
                            </span>
                          </label>

                          <label className="grid gap-2 text-sm font-medium">
                            Minimum accepted questions
                            <input
                              className="ui-input"
                              inputMode="numeric"
                              min="1"
                              onChange={(event) =>
                                setValidationDraft((current) => ({
                                  ...current,
                                  minAcceptedQuestions: event.target.value
                                }))
                              }
                              type="number"
                              value={validationDraft.minAcceptedQuestions}
                            />
                            <span className="text-xs text-[color:var(--app-fg-muted)]">
                              The runtime validator requires at least this many accepted questions.
                            </span>
                          </label>

                          <label className="grid gap-2 text-sm font-medium">
                            Maximum accepted questions
                            <input
                              className="ui-input"
                              inputMode="numeric"
                              min="1"
                              onChange={(event) =>
                                setValidationDraft((current) => ({
                                  ...current,
                                  maxAcceptedQuestions: event.target.value
                                }))
                              }
                              type="number"
                              value={validationDraft.maxAcceptedQuestions}
                            />
                            <span className="text-xs text-[color:var(--app-fg-muted)]">
                              The runtime validator allows at most this many accepted questions.
                            </span>
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex items-start gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-3 text-sm font-medium">
                            <input
                              checked={validationDraft.requireFrenchVous}
                              onChange={(event) =>
                                setValidationDraft((current) => ({
                                  ...current,
                                  requireFrenchVous: event.target.checked
                                }))
                              }
                              type="checkbox"
                            />
                            <span className="grid gap-1">
                              French questions must include <code>vous</code>
                              <span className="text-xs font-normal text-[color:var(--app-fg-muted)]">
                                Rejects indirect French wording that does not address the group
                                directly.
                              </span>
                            </span>
                          </label>

                          <label className="flex items-start gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-3 text-sm font-medium">
                            <input
                              checked={validationDraft.rejectIndirectFrenchWording}
                              onChange={(event) =>
                                setValidationDraft((current) => ({
                                  ...current,
                                  rejectIndirectFrenchWording: event.target.checked
                                }))
                              }
                              type="checkbox"
                            />
                            <span className="grid gap-1">
                              Reject indirect French wording like <code>ce groupe</code>
                              <span className="text-xs font-normal text-[color:var(--app-fg-muted)]">
                                Keeps the questions pointed at the presenting students.
                              </span>
                            </span>
                          </label>

                          <label className="flex items-start gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-3 text-sm font-medium">
                            <input
                              checked={validationDraft.requireReadableLetters}
                              onChange={(event) =>
                                setValidationDraft((current) => ({
                                  ...current,
                                  requireReadableLetters: event.target.checked
                                }))
                              }
                              type="checkbox"
                            />
                            <span className="grid gap-1">
                              Require readable letters
                              <span className="text-xs font-normal text-[color:var(--app-fg-muted)]">
                                Rejects strings that do not look like real text.
                              </span>
                            </span>
                          </label>

                          <label className="flex items-start gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-3 text-sm font-medium">
                            <input
                              checked={validationDraft.rejectDuplicateQuestions}
                              onChange={(event) =>
                                setValidationDraft((current) => ({
                                  ...current,
                                  rejectDuplicateQuestions: event.target.checked
                                }))
                              }
                              type="checkbox"
                            />
                            <span className="grid gap-1">
                              Reject duplicate questions
                              <span className="text-xs font-normal text-[color:var(--app-fg-muted)]">
                                Prevents the model from repeating the same question twice.
                              </span>
                            </span>
                          </label>
                        </div>

                        {showAdminDiagnostics ? (
                          <div className="grid gap-2 text-sm text-[color:var(--app-fg-muted)]">
                            <p className="font-medium text-[color:var(--app-fg)]">
                              Latest validation failures
                            </p>
                            {view.settings.latestQuestionRejectionReasons &&
                            view.settings.latestQuestionRejectionReasons.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {view.settings.latestQuestionRejectionReasons.map((reason, index) => (
                                  <div
                                    key={`${reason}-${index}`}
                                    className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-fg)]"
                                  >
                                    {reason}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p>No validation failures recorded yet.</p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {key === 'generate_challenge_questions' && hasValidationChanges() ? (
                      <p className="text-sm text-[color:var(--app-warning)]">
                        Validation changes are not saved yet.
                      </p>
                    ) : null}

                    <div className="mt-3 grid gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--app-fg-muted)]">
                        Available variables
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {promptMeta.placeholders.map((placeholder) => (
                          <span key={placeholder} className="ui-chip">
                            {placeholder}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--app-fg-muted)]">
                      <span>Updated: {formatDateTime(prompt?.updatedAt ?? null)}</span>
                      <span>•</span>
                      <span>{prompt?.isDefault ? 'Using the default template' : 'Custom template'}</span>
                    </div>
                  </article>
                );
              })}
            </div>

            {hasPromptChanges() ? (
              <p className="mt-4 text-sm text-[color:var(--app-warning)]">
                Prompt changes are not saved yet.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
