import { eq } from 'drizzle-orm';

import {
  branchingAiPromptTemplates,
  branchingAiSecrets,
  branchingAiSettings,
  db
} from '@/db';

import { decryptBranchingAiSecret, encryptBranchingAiSecret } from './crypto';
import { BRANCHING_AI_PROMPT_DEFAULTS } from './prompt-defaults';
import type {
  BranchingAiAdminView,
  BranchingAiPromptTemplateRecord,
  BranchingAiProvider,
  BranchingAiSettingsRecord
} from './types';

const BRANCHING_AI_GLOBAL_KEY = 'global';

type BranchingAiSaveInput = {
  apiBaseUrl?: string | null;
  enabled?: boolean;
  model?: string | null;
  provider?: BranchingAiProvider;
  timeoutMs?: number | null;
};

type BranchingAiPromptSaveInput = {
  prompts: Array<{
    promptKey: BranchingAiPromptTemplateRecord['promptKey'];
    template: string;
  }>;
};

function normalizeString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function getDefaultSettings(): BranchingAiSettingsRecord {
  return {
    apiBaseUrl: null,
    enabled: false,
    key: BRANCHING_AI_GLOBAL_KEY,
    lastTestError: null,
    lastTestedAt: null,
    latestQuestionRejectionReasons: null,
    model: null,
    provider: 'openai-compatible',
    timeoutMs: 15000,
    updatedAt: new Date(),
    verificationStatus: 'not_configured'
  };
}

function getDefaultPromptTemplate(promptKey: BranchingAiPromptTemplateRecord['promptKey']) {
  const entry = BRANCHING_AI_PROMPT_DEFAULTS[promptKey];
  return {
    description: entry.description,
    promptKey,
    template: entry.template,
    title: entry.title,
    updatedAt: new Date()
  };
}

async function ensureBranchingAiSettingsRow(): Promise<BranchingAiSettingsRecord> {
  const rows = await db
    .select()
    .from(branchingAiSettings)
    .where(eq(branchingAiSettings.key, BRANCHING_AI_GLOBAL_KEY))
    .limit(1);

  if (rows[0]) {
    return rows[0] as BranchingAiSettingsRecord;
  }

  const record = getDefaultSettings();
  await db.insert(branchingAiSettings).values({
    apiBaseUrl: record.apiBaseUrl,
    enabled: record.enabled,
    key: record.key,
    lastTestError: record.lastTestError,
    lastTestedAt: record.lastTestedAt,
    latestQuestionRejectionReasons: record.latestQuestionRejectionReasons,
    model: record.model,
    provider: record.provider,
    timeoutMs: record.timeoutMs,
    updatedAt: record.updatedAt,
    verificationStatus: record.verificationStatus
  });

  return record;
}

async function ensureBranchingAiSecretRow() {
  const rows = await db
    .select()
    .from(branchingAiSecrets)
    .where(eq(branchingAiSecrets.key, BRANCHING_AI_GLOBAL_KEY))
    .limit(1);

  return rows[0] ?? null;
}

async function ensureBranchingAiPromptRows() {
  const existing = await db.select().from(branchingAiPromptTemplates);
  const byKey = new Map(existing.map((row) => [row.promptKey, row]));
  const missingKeys = Object.keys(BRANCHING_AI_PROMPT_DEFAULTS).filter(
    (promptKey) => !byKey.has(promptKey)
  ) as Array<BranchingAiPromptTemplateRecord['promptKey']>;

  if (missingKeys.length > 0) {
    await db.insert(branchingAiPromptTemplates).values(
      missingKeys.map((promptKey) => {
        const entry = getDefaultPromptTemplate(promptKey);
        return {
          description: entry.description,
          promptKey: entry.promptKey,
          template: entry.template,
          title: entry.title,
          updatedAt: entry.updatedAt
        };
      })
    );
  }

  const refreshed = missingKeys.length > 0 ? await db.select().from(branchingAiPromptTemplates) : existing;

  return refreshed
    .map((row) => row as BranchingAiPromptTemplateRecord)
    .sort((left, right) => left.promptKey.localeCompare(right.promptKey));
}

function hasBranchingAiConnectionValue(
  current: BranchingAiSettingsRecord,
  next: Partial<BranchingAiSettingsRecord>
) {
  return (
    current.enabled !== next.enabled ||
    current.provider !== next.provider ||
    (current.apiBaseUrl ?? '') !== (next.apiBaseUrl ?? '') ||
    (current.model ?? '') !== (next.model ?? '') ||
    current.timeoutMs !== next.timeoutMs
  );
}

function getNextVerificationStatus(params: {
  current: BranchingAiSettingsRecord;
  connectionChanged: boolean;
  hasApiKey: boolean;
  next: BranchingAiSettingsRecord;
  secretChanged: boolean;
}) {
  if (!params.next.enabled) {
    return 'disabled';
  }

  if (!params.next.provider || !params.next.apiBaseUrl || !params.next.model || !params.hasApiKey) {
    return 'not_configured';
  }

  if (params.connectionChanged || params.secretChanged) {
    return 'saved';
  }

  return params.current.verificationStatus;
}

export async function getBranchingAiAdminView(): Promise<BranchingAiAdminView> {
  const [settings, secret, prompts] = await Promise.all([
    ensureBranchingAiSettingsRow(),
    ensureBranchingAiSecretRow(),
    ensureBranchingAiPromptRows()
  ]);

  const hasApiKey = Boolean(secret?.encryptedApiKey);

  return {
    hasApiKey,
    prompts: prompts.map((prompt) => ({
      ...prompt,
      isDefault: prompt.template === BRANCHING_AI_PROMPT_DEFAULTS[prompt.promptKey].template
    })),
    settings: {
      apiBaseUrl: settings.apiBaseUrl,
      enabled: settings.enabled,
      lastTestError: settings.lastTestError,
      lastTestedAt: settings.lastTestedAt,
      latestQuestionRejectionReasons: settings.latestQuestionRejectionReasons ?? null,
      model: settings.model,
      provider: settings.provider,
      timeoutMs: settings.timeoutMs,
      updatedAt: settings.updatedAt,
      verificationStatus: settings.verificationStatus
    }
  };
}

export async function getBranchingAiFullSettings(): Promise<{
  apiKey: string | null;
  hasApiKey: boolean;
  prompts: BranchingAiPromptTemplateRecord[];
  settings: BranchingAiSettingsRecord;
}> {
  const [settings, secret, prompts] = await Promise.all([
    ensureBranchingAiSettingsRow(),
    ensureBranchingAiSecretRow(),
    ensureBranchingAiPromptRows()
  ]);

  return {
    apiKey: secret ? decryptBranchingAiSecret(secret.encryptedApiKey) : null,
    hasApiKey: Boolean(secret?.encryptedApiKey),
    prompts,
    settings
  };
}

export async function saveBranchingAiSettings(input: BranchingAiSaveInput & { apiKey?: string | null }) {
  const existing = await ensureBranchingAiSettingsRow();
  const provider = input.provider ?? existing.provider;
  const enabled = input.enabled ?? existing.enabled;
  const apiBaseUrl = normalizeString(input.apiBaseUrl ?? existing.apiBaseUrl);
  const model = normalizeString(input.model ?? existing.model);
  const timeoutMs = input.timeoutMs ?? existing.timeoutMs;
  const normalizedNext: BranchingAiSettingsRecord = {
    ...existing,
    apiBaseUrl,
    enabled,
    model,
    provider,
    timeoutMs,
    updatedAt: new Date()
  };

  if (enabled && (!apiBaseUrl || !model)) {
    throw new Error('Enable Branching AI only after setting the provider endpoint and model.');
  }

  const connectionChanged = hasBranchingAiConnectionValue(existing, normalizedNext);
  const secretRow = await ensureBranchingAiSecretRow();
  const hasApiKeyBefore = Boolean(secretRow?.encryptedApiKey);
  const hasApiKeyAfter = hasApiKeyBefore || Boolean(input.apiKey?.trim());
  const secretChanged = Boolean(input.apiKey?.trim());

  if (enabled && (!apiBaseUrl || !model || !hasApiKeyAfter)) {
    throw new Error('Enable Branching AI only after setting the endpoint, model, and API key.');
  }

  const nextStatus = getNextVerificationStatus({
    current: existing,
    connectionChanged,
    hasApiKey: hasApiKeyAfter,
    next: normalizedNext,
    secretChanged
  });

  await db.transaction(async (tx) => {
    if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
      if (!process.env.BRANCHING_AI_ENCRYPTION_KEY?.trim()) {
        throw new Error('BRANCHING_AI_ENCRYPTION_KEY is not set.');
      }

      const encryptedApiKey = encryptBranchingAiSecret(input.apiKey.trim());
      await tx
        .insert(branchingAiSecrets)
        .values({
          encryptedApiKey,
          key: BRANCHING_AI_GLOBAL_KEY,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: branchingAiSecrets.key,
          set: {
            encryptedApiKey,
            updatedAt: new Date()
          }
        });
    }

    await tx
      .insert(branchingAiSettings)
      .values({
        apiBaseUrl: normalizedNext.apiBaseUrl,
        enabled: normalizedNext.enabled,
        key: normalizedNext.key,
        lastTestError: connectionChanged || secretChanged ? null : existing.lastTestError,
        lastTestedAt: connectionChanged || secretChanged ? null : existing.lastTestedAt,
        latestQuestionRejectionReasons: existing.latestQuestionRejectionReasons,
        model: normalizedNext.model,
        provider: normalizedNext.provider,
        timeoutMs: normalizedNext.timeoutMs,
        updatedAt: normalizedNext.updatedAt,
        verificationStatus: nextStatus
      })
      .onConflictDoUpdate({
        target: branchingAiSettings.key,
        set: {
        apiBaseUrl: normalizedNext.apiBaseUrl,
        enabled: normalizedNext.enabled,
        lastTestError: connectionChanged || secretChanged ? null : existing.lastTestError,
        lastTestedAt: connectionChanged || secretChanged ? null : existing.lastTestedAt,
        latestQuestionRejectionReasons: existing.latestQuestionRejectionReasons,
        model: normalizedNext.model,
        provider: normalizedNext.provider,
        timeoutMs: normalizedNext.timeoutMs,
          updatedAt: normalizedNext.updatedAt,
          verificationStatus: nextStatus
        }
      });
  });

  return getBranchingAiAdminView();
}

export async function saveBranchingAiPromptTemplates(input: BranchingAiPromptSaveInput) {
  await ensureBranchingAiPromptRows();

  const updatedAt = new Date();
  for (const prompt of input.prompts) {
    const template = prompt.template.trim();
    if (!template) {
      throw new Error(`Prompt template for ${prompt.promptKey} cannot be empty.`);
    }

    const defaultEntry = BRANCHING_AI_PROMPT_DEFAULTS[prompt.promptKey];
    await db
      .insert(branchingAiPromptTemplates)
      .values({
        description: defaultEntry.description,
        promptKey: prompt.promptKey,
        template,
        title: defaultEntry.title,
        updatedAt
      })
      .onConflictDoUpdate({
        target: branchingAiPromptTemplates.promptKey,
        set: {
          description: defaultEntry.description,
          template,
          title: defaultEntry.title,
          updatedAt
        }
      });
  }

  return getBranchingAiAdminView();
}

export async function resetBranchingAiPromptTemplate(promptKey: BranchingAiPromptTemplateRecord['promptKey']) {
  const defaultEntry = BRANCHING_AI_PROMPT_DEFAULTS[promptKey];
  await db
    .insert(branchingAiPromptTemplates)
    .values({
      description: defaultEntry.description,
      promptKey,
      template: defaultEntry.template,
      title: defaultEntry.title,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: branchingAiPromptTemplates.promptKey,
      set: {
        description: defaultEntry.description,
        template: defaultEntry.template,
        title: defaultEntry.title,
        updatedAt: new Date()
      }
    });

  return getBranchingAiAdminView();
}

export async function saveBranchingAiConnectionTestResult(params: {
  error?: string | null;
  success: boolean;
}) {
  const existing = await ensureBranchingAiSettingsRow();
  const updatedAt = new Date();
  await db
    .update(branchingAiSettings)
    .set({
      lastTestError: params.error ?? null,
      lastTestedAt: updatedAt,
      updatedAt,
      verificationStatus: params.success ? 'verified' : 'failed'
    })
    .where(eq(branchingAiSettings.key, existing.key));

  return getBranchingAiAdminView();
}

export async function saveBranchingAiLatestQuestionRejectionReasons(
  reasons: string[] | null
) {
  const existing = await ensureBranchingAiSettingsRow();
  const normalizedReasons =
    reasons?.map((reason) => reason.trim()).filter((reason) => reason.length > 0) ?? null;
  const updatedAt = new Date();

  await db
    .update(branchingAiSettings)
    .set({
      latestQuestionRejectionReasons:
        normalizedReasons && normalizedReasons.length > 0 ? normalizedReasons : null,
      updatedAt
    })
    .where(eq(branchingAiSettings.key, existing.key));

  return getBranchingAiAdminView();
}

export async function getBranchingAiSavedApiKey() {
  const secretRow = await ensureBranchingAiSecretRow();
  if (!secretRow) {
    return null;
  }

  return decryptBranchingAiSecret(secretRow.encryptedApiKey);
}
