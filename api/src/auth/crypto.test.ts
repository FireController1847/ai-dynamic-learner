// Crypto validation is shared by email/password and provider-session flows.
// This file intentionally contains no credentials or network dependencies.
import { describe, expect, it } from 'vitest';
import { randomToken, sha256, normalizeEmail, validToken, isAcceptablePassword } from './crypto';

describe('Authentication primitives', () => {
  it('creates unique URL-safe opaque tokens', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(validToken(a)).toBe(true);
    expect(validToken(b)).toBe(true);
  });
  it('does not reuse a plaintext secret as the stored token hash', async () => {
    const token = randomToken();
    expect(await sha256(token)).not.toBe(token);
  });
  it('validates email, password and reset token bounds', () => {
    expect(normalizeEmail('  TEST@Example.COM ')).toBe('test@example.com');
    expect(normalizeEmail('not-email')).toBeNull();
    expect(isAcceptablePassword('short')).toBe(false);
    expect(isAcceptablePassword('correct horse battery staple')).toBe(true);
    expect(validToken('<script>')).toBe(false);
  });
});
