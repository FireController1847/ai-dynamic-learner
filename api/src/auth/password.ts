import { checkPassword, hashPassword, isAcceptablePassword, normalizeEmail, validToken } from './crypto';
import { ApiError, assertConfigured, readJson, respond } from './http';
import { actionToken, activeSession, consumeAction, db, issueSession, now, publicSession, rateLimit,
  revokeSession } from './db';
import { expireSessionCookie } from './http';
import { configuredEmail, sendAccountMail } from './mail';
import type { AccountRow, PasswordRow, RuntimeEnv } from './types';

function requireMail(env: RuntimeEnv, request: Request): void {
  if (!configuredEmail(env, request)) throw new ApiError(503, 'Email verification and recovery are not configured.');
}
function rejectDuplicateRegistration(): never {
  // Do not include email/account identifiers in logs or public responses.
  // Verification resend and password recovery are separate endpoints.
  console.warn('[auth] Registration rejected: account already exists.');
  throw new ApiError(500, 'Internal server error.');
}
export async function register(request: Request, env: RuntimeEnv): Promise<Response> {
  assertConfigured(env);
  requireMail(env, request);
  const data = await readJson(request);
  const email = normalizeEmail(data.email);
  if (!email || !isAcceptablePassword(data.password)) {
    throw new ApiError(400, 'Enter a valid email and a password of at least 12 characters.');
  }
  await rateLimit(env, request, 'register-ip', '', 5, 3600);
  await rateLimit(env, request, 'register-email', email, 5, 3600);
  // Accounts from either password or OAuth providers must not be recreated.
  // Do not implicitly link identities based only on matching email addresses.
  const existing = await db(env).prepare('SELECT id FROM accounts WHERE email=? COLLATE NOCASE LIMIT 1')
    .bind(email).first<{ id: string }>();
  if (existing) rejectDuplicateRegistration();
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(data.password, env.AUTH_PEPPER!);
  try {
    await db(env).batch([
      db(env).prepare('INSERT INTO accounts(id,email,email_verified,created_at,updated_at) VALUES(?,?,0,?,?)')
        .bind(id, email, now(), now()),
      db(env).prepare('INSERT INTO password_credentials(email,account_id,password_hash,created_at) VALUES(?,?,?,?)')
        .bind(email, id, passwordHash, now()),
    ]);
  } catch (error) {
    // A concurrent password registration can win during hashing. Return the
    // same generic error, never a detailed SQLite uniqueness violation.
    const raced = await db(env).prepare('SELECT account_id FROM password_credentials WHERE email=?')
      .bind(email).first<{ account_id: string }>();
    if (raced) rejectDuplicateRegistration();
    throw error;
  }
  const token = await actionToken(env, id, 'verify', 3600);
  await sendAccountMail(env, request, email, 'verify', token);
  return respond({ status: 'verification-required', email }, 202);
}
export async function signIn(request: Request, env: RuntimeEnv): Promise<Response> {
  assertConfigured(env);
  const data = await readJson(request);
  const email = normalizeEmail(data.email);
  if (!email || typeof data.password !== 'string' || data.password.length > 256) {
    throw new ApiError(400, 'Invalid email or password.');
  }
  await rateLimit(env, request, 'login-ip', '', 45, 3600);
  await rateLimit(env, request, 'login-email', email, 10, 900);
  const credential = await db(env).prepare('SELECT email,account_id,password_hash FROM password_credentials WHERE email=?')
    .bind(email).first<PasswordRow>();
  if (!credential || !await checkPassword(data.password, env.AUTH_PEPPER!, credential.password_hash)) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  const account = await db(env).prepare('SELECT * FROM accounts WHERE id=?')
    .bind(credential.account_id).first<AccountRow>();
  if (!account) throw new ApiError(401, 'Invalid email or password.');
  if (account.email_verified !== 1) return respond({ status: 'verification-required', email: credential.email });
  const cookie = await issueSession(env, account.id);
  return respond(publicSession(account, 'email'), 200, { 'Set-Cookie': cookie });
}
export async function currentSession(request: Request, env: RuntimeEnv): Promise<Response> {
  assertConfigured(env);
  const session = await activeSession(env, request);
  return respond(session ? publicSession(session.account, session.providerId) : { status: 'signed-out' });
}
export async function signOut(request: Request, env: RuntimeEnv): Promise<Response> {
  assertConfigured(env);
  await revokeSession(env, request);
  return respond({ status: 'signed-out' }, 200, { 'Set-Cookie': expireSessionCookie(env) });
}
export async function resendVerification(request: Request, env: RuntimeEnv): Promise<Response> {
  assertConfigured(env);
  requireMail(env, request);
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!email) throw new ApiError(400, 'Invalid email address.');
  await rateLimit(env, request, 'verify-ip', '', 10, 3600);
  await rateLimit(env, request, 'verify-email', email, 3, 3600);
  const found = await db(env).prepare('SELECT c.account_id,a.email_verified FROM password_credentials c ' +
    'JOIN accounts a ON a.id=c.account_id WHERE c.email=?').bind(email)
    .first<{ account_id: string; email_verified: number }>();
  if (found && found.email_verified === 0) {
    const token = await actionToken(env, found.account_id, 'verify', 3600);
    await sendAccountMail(env, request, email, 'verify', token);
  }
  return respond({ sent: true });
}
export async function verifyEmail(request: Request, env: RuntimeEnv): Promise<Response> {
  assertConfigured(env);
  const data = await readJson(request);
  if (!validToken(data.token)) throw new ApiError(400, 'Invalid verification link.');
  await rateLimit(env, request, 'verify-token', '', 20, 3600);
  const id = await consumeAction(env, data.token, 'verify');
  await db(env).prepare('UPDATE accounts SET email_verified=1,updated_at=? WHERE id=?')
    .bind(now(), id).run();
  const account = await db(env).prepare('SELECT * FROM accounts WHERE id=?').bind(id).first<AccountRow>();
  if (!account) throw new ApiError(503, 'The verified account could not be loaded.');
  const cookie = await issueSession(env, id);
  return respond(publicSession(account, 'email'), 200, { 'Set-Cookie': cookie });
}
export async function requestReset(request: Request, env: RuntimeEnv): Promise<Response> {
  assertConfigured(env);
  requireMail(env, request);
  const data = await readJson(request);
  const email = normalizeEmail(data.email);
  if (!email) throw new ApiError(400, 'Invalid email address.');
  await rateLimit(env, request, 'reset-ip', '', 10, 3600);
  await rateLimit(env, request, 'reset-email', email, 3, 3600);
  const found = await db(env).prepare('SELECT account_id FROM password_credentials WHERE email=?')
    .bind(email).first<{ account_id: string }>();
  if (found) {
    const token = await actionToken(env, found.account_id, 'reset', 1200);
    await sendAccountMail(env, request, email, 'reset', token);
  }
  return respond({ sent: true });
}
export async function completeReset(request: Request, env: RuntimeEnv): Promise<Response> {
  assertConfigured(env);
  const data = await readJson(request);
  if (!validToken(data.token) || !isAcceptablePassword(data.password)) {
    throw new ApiError(400, 'The reset link or new password is invalid (minimum 12 characters).');
  }
  await rateLimit(env, request, 'complete-reset-ip', '', 15, 3600);
  const hash = await hashPassword(data.password, env.AUTH_PEPPER!);
  const accountId = await consumeAction(env, data.token, 'reset');
  await db(env).batch([
    db(env).prepare('UPDATE password_credentials SET password_hash=? WHERE account_id=?').bind(hash, accountId),
    db(env).prepare('DELETE FROM auth_sessions WHERE account_id=?').bind(accountId),
    db(env).prepare('DELETE FROM auth_actions WHERE account_id=? AND kind=?').bind(accountId, 'reset'),
  ]);
  return respond({ reset: true }, 200, { 'Set-Cookie': expireSessionCookie(env) });
}
