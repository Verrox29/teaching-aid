import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  BRANCHING_AI_PROVIDERS,
  BRANCHING_AI_PROMPT_KEYS,
  getBranchingAiAdminView,
  saveBranchingAiPromptTemplates,
  saveBranchingAiSettings
} from '@/lib/ai';
import { requireBranchingAiAdminAccess } from '@/lib/ai/admin-auth';

const connectionSchema = z.object({
  apiBaseUrl: z.string().trim().nullable().optional(),
  apiKey: z.string().trim().nullable().optional(),
  enabled: z.boolean().optional(),
  model: z.string().trim().nullable().optional(),
  provider: z.enum(BRANCHING_AI_PROVIDERS).optional(),
  timeoutMs: z.number().int().min(1000).max(120000).nullable().optional()
});

const promptSchema = z.object({
  promptKey: z.enum(BRANCHING_AI_PROMPT_KEYS),
  template: z.string()
});

const requestSchema = z
  .object({
    connection: connectionSchema.optional(),
    prompts: z.array(promptSchema).optional()
  })
  .refine((value) => Boolean(value.connection || value.prompts), {
    message: 'Provide connection settings or prompt templates to save.'
  });

export async function GET() {
  try {
    await requireBranchingAiAdminAccess();
    const view = await getBranchingAiAdminView();
    return NextResponse.json({ view });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load Branching AI settings.';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireBranchingAiAdminAccess();
    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid Branching AI settings payload.', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let view = await getBranchingAiAdminView();

    if (parsed.data.connection) {
      view = await saveBranchingAiSettings({
        apiBaseUrl: parsed.data.connection.apiBaseUrl ?? null,
        apiKey: parsed.data.connection.apiKey ?? null,
        enabled: parsed.data.connection.enabled,
        model: parsed.data.connection.model ?? null,
        provider: parsed.data.connection.provider,
        timeoutMs: parsed.data.connection.timeoutMs ?? null
      });
    }

    if (parsed.data.prompts) {
      view = await saveBranchingAiPromptTemplates({ prompts: parsed.data.prompts });
    }

    return NextResponse.json({ view });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not save Branching AI settings.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
