import type { BranchingAiConnectionTestResult, BranchingAiSettingsRecord } from './types';

export type BranchingAiClient = {
  testConnection: () => Promise<BranchingAiConnectionTestResult>;
};

type OpenAiCompatibleRequest = {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  timeoutMs: number;
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

export function buildBranchingAiClient(
  settings: BranchingAiSettingsRecord,
  apiKey: string
): BranchingAiClient {
  if (settings.provider !== 'openai-compatible') {
    throw new Error(`Unsupported Branching AI provider: ${settings.provider}`);
  }

  if (!settings.apiBaseUrl?.trim()) {
    throw new Error('API base URL is required.');
  }

  if (!settings.model?.trim()) {
    throw new Error('Model is required.');
  }

  const requestConfig: OpenAiCompatibleRequest = {
    apiBaseUrl: normalizeBaseUrl(settings.apiBaseUrl.trim()),
    apiKey,
    model: settings.model.trim(),
    timeoutMs: settings.timeoutMs
  };

  return {
    async testConnection() {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestConfig.timeoutMs);

      try {
        const response = await fetch(`${requestConfig.apiBaseUrl}/v1/chat/completions`, {
          body: JSON.stringify({
            messages: [{ content: 'ping', role: 'user' }],
            max_tokens: 1,
            model: requestConfig.model,
            temperature: 0
          }),
          headers: {
            Authorization: `Bearer ${requestConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          method: 'POST',
          signal: controller.signal
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(
            `Provider returned ${response.status}${body ? `: ${body.slice(0, 240)}` : ''}`
          );
        }

        return {
          model: requestConfig.model,
          provider: 'openai-compatible',
          status: 'ok'
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Connection test timed out.');
        }

        throw error instanceof Error ? error : new Error('Connection test failed.');
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
