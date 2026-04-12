import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKeyMaterial() {
  const secret = process.env.BRANCHING_AI_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error('BRANCHING_AI_ENCRYPTION_KEY is not set.');
  }

  return createHash('sha256').update(secret).digest();
}

export function isBranchingAiEncryptionConfigured() {
  return Boolean(process.env.BRANCHING_AI_ENCRYPTION_KEY?.trim());
}

export function encryptBranchingAiSecret(value: string) {
  const key = getEncryptionKeyMaterial();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(
    '.'
  );
}

export function decryptBranchingAiSecret(value: string) {
  const key = getEncryptionKeyMaterial();
  const [ivValue, tagValue, payload] = value.split('.');

  if (!ivValue || !tagValue || !payload) {
    throw new Error('Stored Branching AI secret is malformed.');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivValue, 'base64url')
  );

  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(payload, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}
