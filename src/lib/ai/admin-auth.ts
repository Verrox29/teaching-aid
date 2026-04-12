import { createHash } from 'node:crypto';

import { cookies } from 'next/headers';

const COOKIE_NAME = 'branching_ai_admin';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

function getAdminToken() {
  return process.env.BRANCHING_AI_ADMIN_TOKEN?.trim() ?? null;
}

function hashToken(token: string) {
  return createHash('sha256').update(`branching-ai-admin:${token}`).digest('base64url');
}

export async function getBranchingAiAdminAccessState() {
  const cookieStore = await cookies();
  const token = getAdminToken();
  if (!token) {
    return {
      configured: false,
      unlocked: false
    };
  }

  return {
    configured: true,
    unlocked: cookieStore.get(COOKIE_NAME)?.value === hashToken(token)
  };
}

export async function requireBranchingAiAdminAccess() {
  const state = await getBranchingAiAdminAccessState();
  if (!state.configured) {
    throw new Error('BRANCHING_AI_ADMIN_TOKEN is not set.');
  }

  if (!state.unlocked) {
    throw new Error('Branching AI admin access is locked.');
  }
}

export async function unlockBranchingAiAdmin(token: string) {
  const cookieStore = await cookies();
  const expected = getAdminToken();
  if (!expected) {
    throw new Error('BRANCHING_AI_ADMIN_TOKEN is not set.');
  }

  if (token !== expected) {
    throw new Error('Invalid Branching AI admin token.');
  }

  cookieStore.set(COOKIE_NAME, hashToken(expected), {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
}

export async function lockBranchingAiAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
