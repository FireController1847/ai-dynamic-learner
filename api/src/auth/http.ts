import type { RuntimeEnv } from './types';
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export function apiOrigin(env: RuntimeEnv): string {
  const value = env.API_ORIGIN ?? 'https://api.dynlearn.org';
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new ApiError(503, 'Invalid API origin.');
  return url.origin;
}
export function frontendOrigin(env: RuntimeEnv): string {
  const value = env.FRONTEND_ORIGIN ?? 'https://dynlearn.org';
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new ApiError(503, 'Invalid frontend origin.');
  return url.origin;
}
export function frontendProfileUrl(env: RuntimeEnv, fragment?: string): string {
  const url = new URL(frontendOrigin(env) + '/profile/');
  if (fragment) url.hash = fragment;
  return url.toString();
}
export function secureHeaders(): Headers {
  return new Headers({
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  });
}
export function respond(value: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = secureHeaders();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (extra) new Headers(extra).forEach((v, k) => headers.set(k, v));
  return new Response(JSON.stringify(value), { status, headers });
}
export function redirect(location: string, extra?: HeadersInit): Response {
  const headers = secureHeaders();
  headers.set('Location', location);
  if (extra) new Headers(extra).forEach((v, k) => headers.set(k, v));
  return new Response(null, { status: 303, headers });
}
export function allowOrigin(request: Request, env: RuntimeEnv): boolean {
  const origin = request.headers.get('Origin');
  return origin !== null && origin === frontendOrigin(env);
}
export function withCors(request: Request, env: RuntimeEnv, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.append('Vary', 'Origin');
  if (allowOrigin(request, env)) {
    headers.set('Access-Control-Allow-Origin', frontendOrigin(env));
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
  }
  return new Response(response.body, { status: response.status, headers });
}
export function requireOrigin(request: Request, env: RuntimeEnv): void {
  // Origin validation protects credentialed cookie endpoints against cross-site form CSRF.
  if (!allowOrigin(request, env)) throw new ApiError(403, 'Origin not allowed.');
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'JSON body required.');
  }
  const len = Number(request.headers.get('Content-Length') ?? 0);
  if (len > 8192) throw new ApiError(413, 'Request too large.');
  const raw = await request.text();
  if (raw.length > 8192) throw new ApiError(413, 'Request too large.');
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch { /* invalid JSON */ }
  throw new ApiError(400, 'Invalid JSON body.');
}
export function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  const entry = cookie.split(';').map(value => value.trim()).find(value => value.startsWith(name + '='));
  return entry ? entry.slice(name.length + 1) : null;
}
export const SESSION_COOKIE = '__Host-dl_session';
export const OAUTH_COOKIE = '__Host-dl_oauth';
export function setCookie(name: string, value: string, seconds: number, sameSite: 'Lax' | 'Strict' = 'Lax'): string {
  return name + '=' + value + '; Path=/; Max-Age=' + seconds + '; Secure; HttpOnly; SameSite=' + sameSite;
}
export function clearCookie(name: string): string {
  return name + '=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax';
}
export function assertConfigured(env: RuntimeEnv): void {
  if (!env.dynlearn_data || !env.AUTH_PEPPER || env.AUTH_PEPPER.length < 32 ||
      !env.AUTH_RATE_SECRET || env.AUTH_RATE_SECRET.length < 32) {
    throw new ApiError(503, 'Account service has not been configured.');
  }
}
