import { buildBranchingAiClient } from './provider';
import type { BranchingAiConnectionTestResult, BranchingAiSettingsRecord } from './types';

export async function testBranchingAiConnection(
  settings: BranchingAiSettingsRecord,
  apiKey: string
): Promise<BranchingAiConnectionTestResult> {
  const client = buildBranchingAiClient(settings, apiKey);
  return client.testConnection();
}
