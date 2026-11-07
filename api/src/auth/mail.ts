import { ApiError, apiOrigin, frontendOrigin, frontendProfileUrl } from './http';
import type { RuntimeEnv } from './types';

/**
 * Local delivery sink: real password and one-time-token flows, but no email provider.
 * Requires the explicit dev-only flag, BOTH runtime origins on numeric loopback,
 * and an actual request received by the local Worker on that same API origin.
 * A deployed Worker cannot activate this from its ordinary production URL.
 */
export function localMailPreview(env: RuntimeEnv, request: Request): boolean {
  if (env.LOCAL_MAIL_PREVIEW !== '1') return false;
  try {
    const api = new URL(apiOrigin(env));
    const frontend = new URL(frontendOrigin(env));
    const actual = new URL(request.url);
    return api.protocol === 'http:' &&
      frontend.protocol === 'http:' &&
      api.hostname === '127.0.0.1' &&
      frontend.hostname === '127.0.0.1' &&
      actual.origin === api.origin;
  } catch { return false; }
}
export function localMailPreviewChecks(env: RuntimeEnv, request: Request) {
  const api = new URL(apiOrigin(env));
  const frontend = new URL(frontendOrigin(env));
  const actual = new URL(request.url);
  return {
    flagEnabled: env.LOCAL_MAIL_PREVIEW === '1',
    apiLoopback: api.protocol === 'http:' && api.hostname === '127.0.0.1',
    frontendLoopback: frontend.protocol === 'http:' && frontend.hostname === '127.0.0.1',
    requestMatchesApi: actual.origin === api.origin,
    requestOrigin: actual.origin,
  };
}
export function configuredEmail(env: RuntimeEnv, request: Request): boolean {
  return localMailPreview(env, request) || !!(env.RESEND_API_KEY && env.EMAIL_FROM);
}
export async function sendAccountMail(
  env: RuntimeEnv, request: Request, email: string, kind: 'verify' | 'reset', token: string,
): Promise<void> {
  if (!configuredEmail(env, request)) throw new ApiError(503, 'Email delivery has not been configured.');
  const fragment = kind === 'verify' ? 'verify=' : 'reset=';
  const link = frontendProfileUrl(env, fragment + encodeURIComponent(token));

  if (localMailPreview(env, request)) {
    // This is an intentionally local-only mail preview. Never log account
    // verification/recovery links in production.
    console.info('[local-auth] ' + kind + ' link for ' + email + ':\n' + link);
    return;
  }

  const subject = kind === 'verify' ? 'Verify your Dynamic Learner email' : 'Reset your Dynamic Learner password';
  const detail = kind === 'verify' ? 'verify your email address' : 'reset your password';
  const message = 'To ' + detail + ', open this link:\n' + link +
    '\n\nIf you did not request this, you can ignore this email. The link expires soon.';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject, text: message }),
  });
  if (!response.ok) throw new ApiError(502, 'Email delivery is temporarily unavailable.');
}
