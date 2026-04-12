import { NextResponse } from 'next/server';

import {
  getBranchingAiFullSettings,
  saveBranchingAiConnectionTestResult,
  testBranchingAiConnection
} from '@/lib/ai';
import { requireBranchingAiAdminAccess } from '@/lib/ai/admin-auth';

export async function POST() {
  try {
    await requireBranchingAiAdminAccess();
    const current = await getBranchingAiFullSettings();

    if (!current.apiKey) {
      throw new Error('Save an API key before testing the connection.');
    }

    const result = await testBranchingAiConnection(current.settings, current.apiKey);
    const view = await saveBranchingAiConnectionTestResult({ success: true });

    return NextResponse.json({ result, view });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not test Branching AI.';
    try {
      await saveBranchingAiConnectionTestResult({ error: message, success: false });
    } catch {
      // Ignore secondary errors so the original test failure is preserved.
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
