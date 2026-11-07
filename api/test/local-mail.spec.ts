import { createExecutionContext, env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { configuredEmail, localMailPreview, sendAccountMail } from '../src/auth/mail';
import type { RuntimeEnv } from '../src/auth/types';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const loopback = {
  ...env,
  FRONTEND_ORIGIN: 'http://127.0.0.1:3000',
  API_ORIGIN: 'http://127.0.0.1:8787',
  LOCAL_MAIL_PREVIEW: '1',
  RESEND_API_KEY: undefined,
  AUTH_PEPPER: 'p'.repeat(48),
  AUTH_RATE_SECRET: 'r'.repeat(48),
} as RuntimeEnv;

describe('local-only email preview', () => {
  it('reports email availability only on a loopback Worker with the dev flag', async () => {
    const request = new IncomingRequest('http://127.0.0.1:8787/v1/auth/config', {
      headers: { Origin: 'http://127.0.0.1:3000' },
    });
    const response = await worker.fetch(request, loopback, createExecutionContext());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ready: true, email: true });
    expect(localMailPreview(loopback, request)).toBe(true);
    expect(configuredEmail(loopback, request)).toBe(true);
    expect(configuredEmail({ ...loopback, LOCAL_MAIL_PREVIEW: undefined }, request)).toBe(false);
  });

  it('does not activate for public requests or incorrect origins', () => {
    const publicReq = new Request('https://api.dynlearn.org/v1/auth/config');
    const localReq = new Request('http://127.0.0.1:8787/v1/auth/config');
    // Workerd may rewrite the incoming URL, so only trusted dev bindings
    // (not request.url) determine whether the local preview is enabled.
    expect(localMailPreview(loopback, publicReq)).toBe(true);
    expect(localMailPreview({ ...loopback, API_ORIGIN: 'https://api.dynlearn.org' }, localReq)).toBe(false);
    expect(localMailPreview({ ...loopback, FRONTEND_ORIGIN: 'https://dynlearn.org' }, localReq)).toBe(false);
    expect(localMailPreview({ ...loopback, LOCAL_MAIL_PREVIEW: undefined }, localReq)).toBe(false);
    expect(localMailPreview({ ...loopback, LOCAL_MAIL_PREVIEW: '1' },
      new Request('http://localhost:8787/v1/auth/config'))).toBe(true);
  });

  it('prints only local verification links without contacting Resend', async () => {
    const request = new Request('http://127.0.0.1:8787/v1/auth/register');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const outbound = vi.spyOn(globalThis, 'fetch');
    try {
      await sendAccountMail(loopback, request, 'someone@example.test', 'verify', 'sample-dev-only-token');
      expect(outbound).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledOnce();
      expect(log.mock.calls[0]?.[0]).toContain('http://127.0.0.1:3000/profile/#verify=sample-dev-only-token');
    } finally {
      log.mockRestore();
      outbound.mockRestore();
    }
  });
});
