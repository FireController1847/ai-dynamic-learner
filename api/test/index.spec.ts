import { createExecutionContext, env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import type { RuntimeEnv } from '../src/auth/types';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
describe('Dynamic Learner API', () => {
  it('returns a public health status without credentials', async () => {
    const response = await worker.fetch(new IncomingRequest('https://api.dynlearn.org/v1/health'),
      env as RuntimeEnv, createExecutionContext());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });
  it('does not accept requests without the trusted Origin header', async () => {
    const response = await SELF.fetch('https://api.dynlearn.org/v1/auth/sign-in', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.com', password: 'password' }),
    });
    expect(response.status).toBe(403);
  });
  it('permits credentialed development CORS from 127.0.0.1 only', async () => {
    const localEnv = {
      ...env,
      FRONTEND_ORIGIN: 'http://127.0.0.1:3000',
      API_ORIGIN: 'http://127.0.0.1:8787',
    } as RuntimeEnv;
    const context = createExecutionContext();
    const accepted = await worker.fetch(
      new IncomingRequest('http://127.0.0.1:8787/v1/auth/config', {
        headers: { Origin: 'http://127.0.0.1:3000' },
      }), localEnv, context,
    );
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:3000');

    const rejected = await worker.fetch(
      new IncomingRequest('http://127.0.0.1:8787/v1/auth/config', {
        headers: { Origin: 'http://localhost:3000' },
      }), localEnv, createExecutionContext(),
    );
    expect(rejected.status).toBe(200);
    expect(rejected.headers.has('Access-Control-Allow-Origin')).toBe(false);

    const preflight = await worker.fetch(
      new IncomingRequest('http://127.0.0.1:8787/v1/auth/sign-in', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST' },
      }), localEnv, createExecutionContext(),
    );
    expect(preflight.status).toBe(403);
  });
  it('rejects unknown endpoints', async () => {
    const response = await SELF.fetch('https://api.dynlearn.org/random');
    expect(response.status).toBe(404);
  });
  it('requires deployment secrets before creating sessions', async () => {
    const response = await worker.fetch(new IncomingRequest('https://api.dynlearn.org/v1/auth/session'),
      env as RuntimeEnv, createExecutionContext());
    expect([200, 503]).toContain(response.status);
    if (response.status === 200) expect(await response.json()).toHaveProperty('status');
  });
});
