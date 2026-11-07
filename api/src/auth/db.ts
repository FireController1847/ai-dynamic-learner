import { hmac, randomToken, sha256 } from './crypto';
import { ApiError, cookieValue, newSessionCookie, sessionCookieName } from './http';
import { publicProfile, type AccountRow, type RuntimeEnv } from './types';
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export const now = (): number => Math.floor(Date.now() / 1000);
export function db(env: RuntimeEnv): D1Database { return env.dynlearn_data; }
export async function rateLimit(env: RuntimeEnv, request: Request, category: string,
  identity: string, allowed: number, seconds: number): Promise<void> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const bucket = await hmac(env.AUTH_RATE_SECRET!, category + ':' + ip + ':' + identity);
  const timestamp = now();
  const row = await db(env).prepare(
    "INSERT INTO auth_rate_limits (bucket,attempts,reset_at) VALUES (?,1,?) " +
    "ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN reset_at < ? THEN 1 ELSE attempts + 1 END, " +
    "reset_at=CASE WHEN reset_at < ? THEN excluded.reset_at ELSE reset_at END RETURNING attempts"
  ).bind(bucket, timestamp + seconds, timestamp, timestamp).first<{ attempts: number }>();
  if (!row || row.attempts > allowed) throw new ApiError(429, 'Too many requests. Please try again later.');
}
export async function issueSession(env: RuntimeEnv, accountId: string): Promise<string> {
  const token = randomToken();
  await db(env).prepare(
    'INSERT INTO auth_sessions (token_hash,account_id,expires_at,created_at) VALUES (?,?,?,?)'
  ).bind(await sha256(token), accountId, now() + SESSION_SECONDS, now()).run();
  return newSessionCookie(env, token, SESSION_SECONDS);
}
export async function activeSession(env: RuntimeEnv, request: Request): Promise<{
  account: AccountRow; providerId: string; tokenHash: string
} | null> {
  const token = cookieValue(request, sessionCookieName(env));
  if (!token || !/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  const tokenHash = await sha256(token);
  const row = await db(env).prepare(
    'SELECT a.id,a.email,a.email_verified,a.created_at, ' +
    'CASE WHEN c.account_id IS NOT NULL THEN \'email\' ELSE (SELECT provider FROM oauth_identities WHERE account_id=a.id LIMIT 1) END AS provider_id ' +
    'FROM auth_sessions s JOIN accounts a ON a.id=s.account_id ' +
    'LEFT JOIN password_credentials c ON c.account_id=a.id ' +
    'WHERE s.token_hash=? AND s.expires_at>?'
  ).bind(tokenHash, now()).first<AccountRow & { provider_id: string | null }>();
  return row ? { account: row, providerId: row.provider_id ?? 'unknown', tokenHash } : null;
}
export async function revokeSession(env: RuntimeEnv, request: Request): Promise<void> {
  const token = cookieValue(request, sessionCookieName(env));
  if (token && /^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    await db(env).prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await sha256(token)).run();
  }
}
export function publicSession(account: AccountRow, providerId: string) {
  return { status: 'authenticated', account: publicProfile(account, providerId) };
}
export async function actionToken(env: RuntimeEnv, accountId: string, kind: 'verify' | 'reset', ttl: number): Promise<string> {
  const token = randomToken();
  await db(env).prepare('INSERT INTO auth_actions (token_hash,account_id,kind,expires_at,created_at) VALUES (?,?,?,?,?)')
    .bind(await sha256(token), accountId, kind, now() + ttl, now()).run();
  return token;
}
export async function consumeAction(env: RuntimeEnv, token: string, kind: 'verify' | 'reset'): Promise<string> {
  const found = await db(env).prepare(
    'DELETE FROM auth_actions WHERE token_hash=? AND kind=? AND expires_at>? RETURNING account_id'
  ).bind(await sha256(token), kind, now()).first<{ account_id: string }>();
  if (!found) throw new ApiError(400, 'This link is invalid or has expired.');
  return found.account_id;
}

