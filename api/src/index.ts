import { ApiError, apiOrigin, assertConfigured, frontendOrigin, requireOrigin, respond, withCors } from './auth/http';
import { completeReset, currentSession, register, requestReset, resendVerification,
  signIn, signOut, verifyEmail } from './auth/password';
import { oauthCallback, oauthStart } from './auth/oauth';
import type { RuntimeEnv, SocialProvider } from './auth/types';

async function handle(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/v1/health' && request.method === 'GET') {
    return respond({ status: 'ok', service: 'dynamic-learner-api' });
  }
  if (request.method === 'OPTIONS') {
    if (request.headers.get('Origin') !== frontendOrigin(env)) {
      return respond({ error: 'Origin not allowed.' }, 403);
    }
    return new Response(null, { status: 204 });
  }
  if (path === '/v1/auth/config' && request.method === 'GET') {
    const ready = !!(env.dynlearn_data && env.AUTH_PEPPER && env.AUTH_PEPPER.length >= 32 &&
      env.AUTH_RATE_SECRET && env.AUTH_RATE_SECRET.length >= 32);
    return respond({
      ready, email: ready && !!(env.RESEND_API_KEY && env.EMAIL_FROM),
      google: ready && !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      microsoft: ready && !!(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
    });
  }
  const oauthRoute = /^\/v1\/auth\/oauth\/(google|microsoft)\/(start|callback)$/.exec(path);
  if (oauthRoute && request.method === 'GET') {
    assertConfigured(env);
    const provider = oauthRoute[1] as SocialProvider;
    return oauthRoute[2] === 'start'
      ? oauthStart(request, env, provider)
      : oauthCallback(request, env, provider);
  }
  if (!path.startsWith('/v1/auth/')) return respond({ error: 'Not found.' }, 404);
  if (path === '/v1/auth/session' && request.method === 'GET') return currentSession(request, env);
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
  requireOrigin(request, env);
  switch (path) {
    case '/v1/auth/register': return register(request, env);
    case '/v1/auth/sign-in': return signIn(request, env);
    case '/v1/auth/sign-out': return signOut(request, env);
    case '/v1/auth/verify': return verifyEmail(request, env);
    case '/v1/auth/resend-verification': return resendVerification(request, env);
    case '/v1/auth/reset-request': return requestReset(request, env);
    case '/v1/auth/reset-complete': return completeReset(request, env);
    default: return respond({ error: 'Not found.' }, 404);
  }
}
export default {
  async fetch(request, env): Promise<Response> {
    try {
      // Only the configured frontend may make credentialed cross-origin calls.
      const result = await handle(request, env);
      return withCors(request, env, result);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        console.error('Account API request failed:', error instanceof Error ? error.name : 'unknown error');
      }
      const status = error instanceof ApiError ? error.status : 503;
      const message = error instanceof ApiError ? error.message : 'Account service temporarily unavailable.';
      try { return withCors(request, env, respond({ error: message }, status)); }
      catch { return respond({ error: 'Service configuration unavailable.' }, 503); }
    }
  },
} satisfies ExportedHandler<RuntimeEnv>;
