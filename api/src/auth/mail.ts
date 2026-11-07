import { ApiError, frontendProfileUrl } from './http';
import type { RuntimeEnv } from './types';
export function configuredEmail(env: RuntimeEnv): boolean {
  return !!(env.RESEND_API_KEY && env.EMAIL_FROM);
}
export async function sendAccountMail(
  env: RuntimeEnv, email: string, kind: 'verify' | 'reset', token: string,
): Promise<void> {
  if (!configuredEmail(env)) throw new ApiError(503, 'Email delivery has not been configured.');
  const fragment = kind === 'verify' ? 'verify=' : 'reset=';
  const link = frontendProfileUrl(env, fragment + encodeURIComponent(token));
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
