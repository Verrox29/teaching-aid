import type { BranchingAiPromptKey } from './prompt-defaults';

export const BRANCHING_AI_PROVIDERS = ['openai-compatible'] as const;

export type BranchingAiProvider = (typeof BRANCHING_AI_PROVIDERS)[number];

export const BRANCHING_AI_VERIFICATION_STATUSES = [
  'not_configured',
  'saved',
  'verified',
  'failed',
  'disabled'
] as const;

export type BranchingAiVerificationStatus = (typeof BRANCHING_AI_VERIFICATION_STATUSES)[number];

export type BranchingAiSettingsRecord = {
  apiBaseUrl: string | null;
  enabled: boolean;
  key: string;
  lastTestError: string | null;
  lastTestedAt: Date | null;
  model: string | null;
  provider: BranchingAiProvider;
  timeoutMs: number;
  updatedAt: Date;
  verificationStatus: BranchingAiVerificationStatus;
};

export type BranchingAiSecretRecord = {
  encryptedApiKey: string;
  key: string;
  updatedAt: Date;
};

export type BranchingAiPromptTemplateRecord = {
  description: string;
  promptKey: BranchingAiPromptKey;
  template: string;
  title: string;
  updatedAt: Date;
};

export type BranchingAiPromptTemplateView = BranchingAiPromptTemplateRecord & {
  isDefault: boolean;
};

export type BranchingAiAdminView = {
  hasApiKey: boolean;
  prompts: BranchingAiPromptTemplateView[];
  settings: Omit<BranchingAiSettingsRecord, 'key'>;
};

export type BranchingAiConnectionTestResult = {
  model: string;
  provider: BranchingAiProvider;
  status: 'ok';
};
