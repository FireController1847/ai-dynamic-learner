import { randomToken, sha256, normalizeEmail, validToken } from './crypto';
import { ApiError, OAUTH_COOKIE, apiOrigin, clearCookie, cookieValue,
  frontendProfileUrl, redirect, setCookie } from './http';
import { db, issueSession, now, publicSession, rateLimit } from './db';
import type { AccountRow, OAuthRequestRow, RuntimeEnv, SocialProvider } from './types';

function providerConfig(provider: SocialProvider, env: RuntimeEnv): {
  clientId: string; clientSecret: string; authorize: string; token: string; userinfo: string
} {
  const google = provider === 'google';
  const clientId = google ? env.GOOGLE_CLIENT_ID : env.MICROSOFT_CLIENT_ID;
  const clientSecret = google ? env.GOOGLE_CLIENT_SECRET : env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new ApiError(503, provider + ' sign-in is not configured.');
  return google
    ? { clientId, clientSecret, authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
      token: 'https://oauth2.googleapis.com/token',
      userinfo: 'https://openidconnect.googleapis.com/v1/userinfo' }
    : { clientId, clientSecret,
      authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userinfo: 'https://graph.microsoft.com/oidc/userinfo' };
}
function callbackUrl(env: RuntimeEnv, provider: SocialProvider): string {
  return apiOrigin(env) + '/v1/auth/oauth/' + provider + '/callback';
}
function frontRedirect(env: RuntimeEnv, outcome: 'success' | 'error', cookie?: string): Response {
  const url = new URL(frontendProfileUrl(env));
  url.searchParams.set('auth', outcome);
  return redirect(url.toString(), cookie ? { 'Set-Cookie': cookie } : undefined);
}
export async function oauthStart(request: Request, env: RuntimeEnv,
  provider: SocialProvider): Promise<Response> {
  const config = providerConfig(provider, env);
  await rateLimit(env, request, 'oauth-start-ip', '', 30, 3600);
  const state = randomToken();
  const verifier = randomToken(48);
  const browser = randomToken();
  const challenge = await sha256(verifier);
  await db(env).prepare(
    'INSERT INTO oauth_requests(state_hash,browser_hash,provider,code_verifier,expires_at) VALUES(?,?,?,?,?)'
  ).bind(await sha256(state), await sha256(browser), provider, verifier, now() + 600).run();
  const url = new URL(config.authorize);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', callbackUrl(env, provider));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  return redirect(url.toString(), { 'Set-Cookie': setCookie(OAUTH_COOKIE, browser, 600) });
}
interface UserInfo { sub?: unknown; email?: unknown; email_verified?: unknown }
async function exchange(code: string, config: ReturnType<typeof providerConfig>,
  redirectUri: string, verifier: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code, client_id: config.clientId, client_secret: config.clientSecret,
    redirect_uri: redirectUri, code_verifier: verifier,
  });
  const response = await fetch(config.token, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!response.ok) throw new ApiError(401, 'The identity provider could not complete sign-in.');
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('access_token' in result) ||
    typeof result.access_token !== 'string' || result.access_token.length > 8192) {
    throw new ApiError(401, 'Identity provider returned an invalid access token.');
  }
  return result.access_token;
}
async function fetchIdentity(token: string, config: ReturnType<typeof providerConfig>): Promise<UserInfo> {
  const response = await fetch(config.userinfo, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
  });
  if (!response.ok) throw new ApiError(401, 'The identity provider could not verify this user.');
  const user: unknown = await response.json();
  if (!user || typeof user !== 'object' || !('sub' in user) ||
      typeof user.sub !== 'string' || user.sub.length < 1 || user.sub.length > 255) {
    throw new ApiError(401, 'The identity provider returned an invalid subject.');
  }
  return user as UserInfo;
}
async function socialAccount(env: RuntimeEnv, provider: SocialProvider, subject: string,
  email: string | null, verified: boolean): Promise<AccountRow> {
  const existing = await db(env).prepare(
    'SELECT a.* FROM accounts a JOIN oauth_identities i ON i.account_id=a.id WHERE i.provider=? AND i.subject=?'
  ).bind(provider, subject).first<AccountRow>();
  if (existing) {
    if (existing.email !== email || (verified && existing.email_verified === 0)) {
      await db(env).prepare('UPDATE accounts SET email=?,email_verified=?,updated_at=? WHERE id=?')
        .bind(email, verified ? 1 : 0, now(), existing.id).run();
      return { ...existing, email, email_verified: verified ? 1 : 0 };
    }
    return existing;
  }
  const id = crypto.randomUUID();
  try {
    await db(env).batch([
      db(env).prepare('INSERT INTO accounts(id,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?)')
        .bind(id, email, verified ? 1 : 0, now(), now()),
      db(env).prepare('INSERT INTO oauth_identities(provider,subject,account_id,created_at) VALUES(?,?,?,?)')
        .bind(provider, subject, id, now()),
    ]);
  } catch {
    const raced = await db(env).prepare(
      'SELECT a.* FROM accounts a JOIN oauth_identities i ON i.account_id=a.id WHERE i.provider=? AND i.subject=?'
    ).bind(provider, subject).first<AccountRow>();
    if (raced) return raced;
    throw new ApiError(503, 'Account creation is temporarily unavailable.');
  }
  return { id, email, email_verified: verified ? 1 : 0, created_at: now() };
}
export async function oauthCallback(request: Request, env: RuntimeEnv,
  provider: SocialProvider): Promise<Response> {
  const cleared = clearCookie(OAUTH_COOKIE);
  try {
    const config = providerConfig(provider, env);
    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const browser = cookieValue(request, OAUTH_COOKIE);
    if (url.searchParams.has('error') || !validToken(state) ||
        !validToken(browser) || !code || code.length > 4096) {
      return frontRedirect(env, 'error', cleared);
    }
    // Atomic one-use state + browser binding prevents login CSRF and replay.
    const flow = await db(env).prepare(
      'DELETE FROM oauth_requests WHERE state_hash=? AND browser_hash=? AND provider=? AND expires_at>? ' +
      'RETURNING browser_hash,code_verifier,provider,expires_at'
    ).bind(await sha256(state), await sha256(browser), provider, now()).first<OAuthRequestRow>();
    if (!flow) return frontRedirect(env, 'error', cleared);
    const accessToken = await exchange(code, config, callbackUrl(env, provider), flow.code_verifier);
    const user = await fetchIdentity(accessToken, config);
    const subject = user.sub as string;
    // Provider subject, never email, is the stable key. No automatic linking by email.
    const email = normalizeEmail(user.email);
    const verified = provider === 'google' && user.email_verified === true && email !== null;
    const account = await socialAccount(env, provider, subject, email, verified);
    const cookie = await issueSession(env, account.id);
    const urlFront = new URL(frontendProfileUrl(env));
    urlFront.searchParams.set('auth', 'success');
    // Append rather than combine Set-Cookie headers; each cookie must have its own header.
    const response = redirect(urlFront.toString(), { 'Set-Cookie': cookie });
    response.headers.append('Set-Cookie', cleared);
    return response;
  } catch (error) {
    console.error('OAuth callback failed:', error instanceof ApiError ? error.message : 'unexpected error');
    return frontRedirect(env, 'error', cleared);
  }
}
