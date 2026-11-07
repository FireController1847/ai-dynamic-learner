import type { AuthProvider, AuthCapabilities, AuthResult, RestoreResult, EmailCredentials, OAuthProvider } from '../core/auth/provider.ts';

// Injected at build time: production always uses api.dynlearn.org, whereas
// local development uses a local Wrangler Worker with its own D1 database.
// Never allow local UI previews to bypass production origin/CSRF restrictions.
declare const __DYNLEARN_AUTH_API_ORIGIN__: string;
const API_ORIGIN = __DYNLEARN_AUTH_API_ORIGIN__;

async function request<T>(path: string, payload?: Record<string, unknown>): Promise<T> {
  const response = await fetch(API_ORIGIN + path, {
    method: payload ? 'POST' : 'GET',
    credentials: 'include',
    mode: 'cors',
    cache: 'no-store',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error('The account service returned an invalid response.'); }
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body &&
      typeof body.error === 'string' ? body.error : 'The account request could not be completed.';
    throw new Error(error);
  }
  return body as T;
}

export const configuredAuthProvider: AuthProvider = {
  id: 'dynamic-learner-cloudflare',
  async capabilities(): Promise<AuthCapabilities> {
    const status = await request<AuthCapabilities>('/v1/auth/config');
    return {
      ready: status.ready === true, email: status.email === true,
      google: status.google === true, microsoft: status.microsoft === true,
    };
  },
  oauthStart(provider: OAuthProvider): string {
    if (provider !== 'google' && provider !== 'microsoft') throw new Error('Unsupported sign-in provider.');
    return API_ORIGIN + '/v1/auth/oauth/' + provider + '/start';
  },
  async restore(): Promise<RestoreResult | { status: 'unavailable' }> {
    return request<RestoreResult | { status: 'unavailable' }>('/v1/auth/session');
  },
  signIn(credentials: EmailCredentials): Promise<AuthResult> {
    return request('/v1/auth/sign-in', { email: credentials.email, password: credentials.password });
  },
  register(credentials: EmailCredentials): Promise<AuthResult> {
    return request('/v1/auth/register', { email: credentials.email, password: credentials.password });
  },
  async requestPasswordReset(email: string): Promise<void> {
    await request('/v1/auth/reset-request', { email });
  },
  async resendVerification(email: string): Promise<void> {
    await request('/v1/auth/resend-verification', { email });
  },
  async verifyEmail(token: string): Promise<void> {
    await request('/v1/auth/verify', { token });
  },
  async completePasswordReset(token: string, password: string): Promise<void> {
    await request('/v1/auth/reset-complete', { token, password });
  },
  async signOut(): Promise<void> {
    await request('/v1/auth/sign-out', {});
  },
};
