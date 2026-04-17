import { inflateRawSync, inflateSync } from 'node:zlib';

const MAX_READABLE_TEXT_LENGTH = 6000;
const MIN_WORDS_FOR_TEXT = 3;

function isLikelyBase64(value: string) {
  const compact = value.replace(/\s+/g, '');
  return compact.length >= 64 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact);
}

function stripDiacritics(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function countLetters(value: string) {
  return (value.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
}

function countWords(value: string) {
  return value
    .split(/[^A-Za-z0-9À-ÿ]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean).length;
}

function looksLikeNaturalWord(word: string) {
  const normalized = stripDiacritics(word).toLowerCase();

  if (normalized.length < 3) {
    return false;
  }

  if (/[0-9]/.test(normalized)) {
    return false;
  }

  if (!/[aeiouy]/.test(normalized)) {
    return false;
  }

  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(normalized)) {
    return false;
  }

  return true;
}

export function isHumanReadablePhrase(value: string) {
  const line = value.replace(/\s+/g, ' ').trim();
  if (!line) {
    return false;
  }

  if (/[0-9]/.test(line)) {
    return false;
  }

  if (/[\\^_`~<>[\]{}|]/.test(line)) {
    return false;
  }

  const letters = countLetters(line);
  if (letters < 6) {
    return false;
  }

  const words = stripDiacritics(line)
    .toLowerCase()
    .split(/[^a-z]+/g)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length < 2) {
    return false;
  }

  if (words.some((word) => word.length > 18)) {
    return false;
  }

  const meaningfulWords = words.filter((word) => word.length >= 3);
  if (meaningfulWords.length < 2) {
    return false;
  }

  if (!meaningfulWords.every(looksLikeNaturalWord)) {
    return false;
  }

  const weirdCharacters = (line.match(/[^A-Za-z0-9À-ÿ\s.,;:!?'"()\-–—/&%+]/g) ?? []).length;
  return weirdCharacters / Math.max(1, line.length) <= 0.2;
}

function isReadableLine(value: string) {
  const line = value.replace(/\s+/g, ' ').trim();
  if (!line) {
    return false;
  }

  if (/^[0-9./:;,\-]+$/.test(line)) {
    return false;
  }

  if (/[A-Za-z0-9+/]{32,}={0,2}/.test(line)) {
    return false;
  }

  if (!isHumanReadablePhrase(line)) {
    return false;
  }

  return countLetters(line) >= 3;
}

function sanitizeReadableText(value: string) {
  const normalized = value.replace(/\u0000/g, ' ').replace(/\r/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(isReadableLine);

  const dedupedLines: string[] = [];
  for (const line of lines) {
    if (!dedupedLines.includes(line)) {
      dedupedLines.push(line);
    }
  }

  const joined = dedupedLines.join('\n').trim();
  if (joined) {
    const truncated = joined.slice(0, MAX_READABLE_TEXT_LENGTH).trim();
    if (countWords(truncated) >= MIN_WORDS_FOR_TEXT || countLetters(truncated) >= 20) {
      return truncated;
    }
  }

  const singleLine = normalized.replace(/\s+/g, ' ').trim();
  if (isReadableLine(singleLine)) {
    const truncated = singleLine.slice(0, MAX_READABLE_TEXT_LENGTH).trim();
    if (countWords(truncated) >= MIN_WORDS_FOR_TEXT || countLetters(truncated) >= 20) {
      return truncated;
    }
  }

  return null;
}

function isPdfBuffer(buffer: Buffer, fileName?: string | null) {
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return true;
  }

  return fileName?.toLowerCase().endsWith('.pdf') ?? false;
}

function decodePdfLiteralString(token: string) {
  const value = token.slice(1, -1);
  let result = '';

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== '\\') {
      result += character;
      continue;
    }

    const next = value[index + 1];
    if (next === undefined) {
      break;
    }

    index += 1;

    switch (next) {
      case 'b':
        result += '\b';
        continue;
      case 'f':
        result += '\f';
        continue;
      case 'n':
        result += '\n';
        continue;
      case 'r':
        result += '\r';
        continue;
      case 't':
        result += '\t';
        continue;
      case '(':
      case ')':
      case '\\':
        result += next;
        continue;
      case '\n':
        continue;
      case '\r':
        if (value[index + 1] === '\n') {
          index += 1;
        }
        continue;
      default: {
        if (/[0-7]/.test(next)) {
          let octal = next;
          while (index + 1 < value.length && octal.length < 3 && /[0-7]/.test(value[index + 1])) {
            octal += value[++index];
          }
          result += String.fromCharCode(Number.parseInt(octal, 8));
          continue;
        }

        result += next;
      }
    }
  }

  return result;
}

function decodePdfHexString(token: string) {
  const hex = token.slice(1, -1).replace(/\s+/g, '');
  if (!hex) {
    return '';
  }

  const normalizedHex = hex.length % 2 === 0 ? hex : `${hex}0`;
  const bytes = Buffer.from(normalizedHex, 'hex');
  if (bytes.length === 0) {
    return '';
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let result = '';
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      result += String.fromCharCode(bytes.readUInt16BE(index));
    }
    return result;
  }

  const utf8 = bytes.toString('utf8').replace(/\u0000/g, '');
  const latin1 = bytes.toString('latin1');
  const utf16Candidate =
    bytes.length >= 2 && bytes.length % 2 === 0
      ? Array.from({ length: bytes.length / 2 }, (_, index) =>
          String.fromCharCode(bytes.readUInt16BE(index * 2))
        ).join('')
      : '';

  const candidates = [utf8, utf16Candidate, latin1]
    .map((candidate) => candidate.trim())
    .filter(Boolean);

  return candidates.sort((left, right) => {
    const leftScore = countLetters(left) + countWords(left);
    const rightScore = countLetters(right) + countWords(right);
    return rightScore - leftScore;
  })[0] ?? '';
}

function decodePdfToken(token: string) {
  if (token.startsWith('(')) {
    return decodePdfLiteralString(token);
  }

  return decodePdfHexString(token);
}

function extractPdfContentText(content: string) {
  const tokens = content.match(/\((?:\\.|[^\\()])*\)|<[^>]*>/g) ?? [];
  const fragments = tokens
    .map((token) => decodePdfToken(token))
    .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(isReadableLine);

  const dedupedFragments: string[] = [];
  for (const fragment of fragments) {
    if (!dedupedFragments.includes(fragment)) {
      dedupedFragments.push(fragment);
    }
  }

  return dedupedFragments.join(' ');
}

function inflatePdfStream(buffer: Buffer) {
  try {
    return inflateSync(buffer);
  } catch {
    try {
      return inflateRawSync(buffer);
    } catch {
      return null;
    }
  }
}

function extractPdfReadableText(buffer: Buffer) {
  const source = buffer.toString('latin1');
  const fragments: string[] = [];
  const objectPattern = /(\d+\s+\d+\s+obj[\s\S]*?)stream\r?\n([\s\S]*?)\r?\nendstream/g;

  let match: RegExpExecArray | null;
  while ((match = objectPattern.exec(source))) {
    const objectText = match[1];
    const streamText = match[2];

    if (!/(?:\bTj\b|\bTJ\b|['"])/.test(streamText)) {
      continue;
    }

    let streamBuffer = Buffer.from(streamText, 'latin1');
    if (/\/FlateDecode\b/.test(objectText)) {
      const inflated = inflatePdfStream(streamBuffer);
      if (!inflated) {
        continue;
      }
      streamBuffer = inflated;
    }

    const extracted = extractPdfContentText(streamBuffer.toString('latin1'));
    if (extracted) {
      fragments.push(extracted);
    }
  }

  if (fragments.length === 0) {
    return null;
  }

  return sanitizeReadableText(fragments.join('\n'));
}

function extractPlainReadableText(value: string) {
  return sanitizeReadableText(value);
}

export function extractSubmissionTextForAi(
  rawContent: string | null | undefined,
  fileName?: string | null
) {
  const normalized = rawContent?.trim() ?? '';
  if (!normalized) {
    return null;
  }

  if (isLikelyBase64(normalized)) {
    const decoded = Buffer.from(normalized.replace(/\s+/g, ''), 'base64');
    if (decoded.length === 0) {
      return null;
    }

    if (isPdfBuffer(decoded, fileName)) {
      return extractPdfReadableText(decoded);
    }

    const text = decoded.toString('utf8');
    return isReadableLine(text) ? extractPlainReadableText(text) : null;
  }

  return extractPlainReadableText(normalized);
}
