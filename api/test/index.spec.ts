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
