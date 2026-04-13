import type { BranchingAiConnectionTestResult, BranchingAiSettingsRecord } from './types';

export type BranchingAiChatMessage = {
  content: string;
  role: 'assistant' | 'system' | 'user';
};

export type BranchingAiChatCompletionOptions = {
  maxTokens?: number;
  messages: BranchingAiChatMessage[];
  responseFormat?:
    | { type: 'json_object' }
    | {
        json_schema: {
          name: string;
          schema: unknown;
          strict?: boolean;
        };
        type: 'json_schema';
      };
  temperature?: number;
};

export type BranchingAiClient = {
  generateChatCompletion: (
    options: BranchingAiChatCompletionOptions
  ) => Promise<string>;
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

async function executeChatCompletion(
  requestConfig: OpenAiCompatibleRequest,
  options: BranchingAiChatCompletionOptions
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestConfig.timeoutMs);

  try {
    const response = await fetch(`${requestConfig.apiBaseUrl}/v1/chat/completions`, {
      body: JSON.stringify({
        ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
        max_tokens: options.maxTokens ?? 1024,
        messages: options.messages,
        model: requestConfig.model,
        temperature: options.temperature ?? 0
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
      throw new Error(`Provider returned ${response.status}${body ? `: ${body.slice(0, 240)}` : ''}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        } | null;
      }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim() ?? '';

    if (!content) {
      throw new Error('Provider response did not include message content.');
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI request timed out.');
    }

    throw error instanceof Error ? error : new Error('AI request failed.');
  } finally {
    clearTimeout(timeout);
  }
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
    async generateChatCompletion(options: BranchingAiChatCompletionOptions) {
      return executeChatCompletion(requestConfig, options);
    },

    async testConnection() {
      await executeChatCompletion(requestConfig, {
        maxTokens: 1,
        messages: [{ content: 'ping', role: 'user' }],
        temperature: 0
      });

      return {
        model: requestConfig.model,
        provider: 'openai-compatible',
        status: 'ok'
      };
    }
  };
}
