import { ApiError, apiOrigin, frontendOrigin, frontendProfileUrl } from './http';
import type { RuntimeEnv } from './types';

/**
 * Local delivery sink: real password and one-time-token flows, but no email provider.
 * Requires the explicit dev-only flag and BOTH configured origins on numeric
 * loopback. Wrangler may internally rewrite request.url to the configured
 * Worker origin even when the HTTP listener is on 127.0.0.1, so request.url
 * must NOT be used to identify local mode. All POST routes still enforce the
 * exact configured frontend Origin. The production Worker never receives
 * LOCAL_MAIL_PREVIEW via its production Wrangler configuration.
 */
export function localMailPreview(env: RuntimeEnv, _request: Request): boolean {
  if (env.LOCAL_MAIL_PREVIEW !== '1') return false;
  try {
    const api = new URL(apiOrigin(env));
    const frontend = new URL(frontendOrigin(env));
    return api.protocol === 'http:' &&
      frontend.protocol === 'http:' &&
      api.hostname === '127.0.0.1' &&
      frontend.hostname === '127.0.0.1';
  } catch { return false; }
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
