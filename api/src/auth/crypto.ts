const encoder = new TextEncoder();
const decoder = new TextDecoder();
export function randomToken(length = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64url(bytes);
}
export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decode64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
export async function sha256(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
export async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
// PBKDF2-SHA256 with a per-credential random salt and an optional server-side pepper.
// The pepper is required at runtime to mitigate an isolated D1 dump leak.
const ITERATIONS = 600_000;
export async function hashPassword(password: string, pepper: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password + pepper), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return 'pbkdf2-sha256$' + ITERATIONS + '$' + base64url(salt) + '$' + base64url(new Uint8Array(bits));
}
export async function checkPassword(password: string, pepper: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256' ||
    !Number.isInteger(Number(parts[1])) || Number(parts[1]) < 300_000 || Number(parts[1]) > 1_000_000) return false;
  try {
    const salt = decode64(parts[2]!);
    const expected = decode64(parts[3]!);
    if (salt.length !== 16 || expected.length !== 32) return false;
    const key = await crypto.subtle.importKey('raw', encoder.encode(password + pepper), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({
      name: 'PBKDF2', hash: 'SHA-256', salt, iterations: Number(parts[1]),
    }, key, 256));
    let diff = 0;
    for (let i = 0; i < bits.length; i++) diff |= bits[i]! ^ expected[i]!;
    return diff === 0;
  } catch { return false; }
}
export function isAcceptablePassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 256 &&
    encoder.encode(value).length <= 1024;
}
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
export function validToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{30,120}$/.test(value);
}
