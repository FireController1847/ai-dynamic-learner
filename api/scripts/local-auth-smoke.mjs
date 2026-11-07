/**
 * Integration smoke test: runs actual Wrangler HTTP server, not a mocked
 * Worker fetch, to verify the local email preview and CLI variable overrides.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = 18787;
const frontend = 'http://127.0.0.1:13000';
const api = 'http://127.0.0.1:' + port;
const args = [
  process.env.npm_execpath, 'exec', '--', 'wrangler', 'dev',
  '--local', '--ip', '127.0.0.1', '--port', String(port),
  '--var', 'FRONTEND_ORIGIN:' + frontend,
  '--var', 'API_ORIGIN:' + api,
  '--var', 'LOCAL_MAIL_PREVIEW:1',
  '--var', 'AUTH_PEPPER:' + 'a'.repeat(48),
  '--var', 'AUTH_RATE_SECRET:' + 'b'.repeat(48),
];
if (!process.env.npm_execpath) throw new Error('npm_execpath is required: run through npm.');
const migrate = spawnSync(process.execPath, [
  process.env.npm_execpath, 'exec', '--', 'wrangler', 'd1',
  'migrations', 'apply', 'dynlearn-data', '--local',
], { cwd: apiDir, env: { ...process.env, CI: '1' }, stdio: 'inherit' });
if (migrate.status !== 0) throw new Error('Could not initialize local D1 for smoke tests.');
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('base64url');
const testAccount = randomUUID();
const verifiedAccount = randomUUID();
const verificationToken = randomBytes(32).toString('base64url');
const verificationHash = createHash('sha256').update(verificationToken).digest('base64url');
const seconds = Math.floor(Date.now() / 1000);
const setupSql = [
  "INSERT INTO accounts(id,email,email_verified,created_at,updated_at) VALUES(" +
    "'" + testAccount + "','ci@example.test',1," + seconds + "," + seconds + ");",
  "INSERT INTO auth_sessions(token_hash,account_id,expires_at,created_at) VALUES(" +
    "'" + tokenHash + "','" + testAccount + "'," + (seconds + 3600) + "," + seconds + ");",
  "INSERT INTO accounts(id,email,email_verified,created_at,updated_at) VALUES(" +
    "'" + verifiedAccount + "','new-ci@example.test',0," + seconds + "," + seconds + ");",
  "INSERT INTO auth_actions(token_hash,account_id,kind,expires_at,created_at) VALUES(" +
    "'" + verificationHash + "','" + verifiedAccount + "','verify'," + (seconds + 3600) + "," + seconds + ");",
].join(' ');
const seeded = spawnSync(process.execPath, [
  process.env.npm_execpath, 'exec', '--', 'wrangler', 'd1',
  'execute', 'dynlearn-data', '--local', '--command', setupSql,
], { cwd: apiDir, env: { ...process.env, CI: '1' }, stdio: 'inherit' });
if (seeded.status !== 0) throw new Error('Could not create local test account.');

const child = spawn(process.execPath, args, {
  cwd: apiDir, env: { ...process.env, CI: '1' },
  stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
});
let logs = '';
child.stdout.on('data', part => { logs += String(part); logs = logs.slice(-18000); });
child.stderr.on('data', part => { logs += String(part); logs = logs.slice(-18000); });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function exerciseVerification() {
  const response = await fetch(api + '/v1/auth/verify', {
    method: 'POST',
    headers: { Origin: frontend, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: verificationToken }),
  });
  const result = await response.json();
  if (response.status !== 200 || result.status !== 'authenticated' ||
      result.account?.id !== verifiedAccount) {
    throw new Error('Verification did not establish authenticated session: ' + JSON.stringify(result));
  }
  const cookie = response.headers.get('Set-Cookie') ?? '';
  if (!cookie.startsWith('dl_dev_session=') || cookie.includes('Secure')) {
    throw new Error('Loopback session cookie was not created with local-only attributes.');
  }
  const sessionResponse = await fetch(api + '/v1/auth/session', {
    headers: { Origin: frontend, Cookie: cookie.split(';')[0] },
  });
  const session = await sessionResponse.json();
  if (session.status !== 'authenticated' || session.account?.id !== verifiedAccount) {
    throw new Error('Verified session could not be restored.');
  }
  console.log('Local email verification and session cookie test PASSED.');
}
async function exerciseSync() {
  const authHeaders = { Origin: frontend, Cookie: 'dl_dev_session=' + token };
  const manifestResponse = await fetch(api + '/v1/sync/manifest', { headers: authHeaders });
  if (manifestResponse.status !== 200) throw new Error('Cloud manifest HTTP ' + manifestResponse.status);
  const initial = await manifestResponse.json();
  if (initial.revision !== 0) throw new Error('Expected a new account to have no synced workspace.');
  const json = '{"format":"dynamic-learner","version":1,"features":{"index-cards":{"items":[]}}}';
  const fingerprint = createHash('sha256').update(json).digest('hex');
  async function post(path, body) {
    const response = await fetch(api + path, {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, value: await response.json() };
  }
  const started = await post('/v1/sync/start', {
    expectedRevision: 0, chunks: 1, units: json.length, digest: fingerprint,
  });
  if (started.status !== 201) throw new Error('Could not start cloud upload: ' + JSON.stringify(started));
  const uploadId = started.value.uploadId;
  const stored = await post('/v1/sync/chunk', { uploadId, index: 0, data: json });
  if (stored.status !== 200) throw new Error('Could not store snapshot chunk: ' + JSON.stringify(stored));
  const published = await post('/v1/sync/publish', { uploadId });
  if (published.status !== 200 || published.value.revision !== 1) {
    throw new Error('Could not publish cloud snapshot: ' + JSON.stringify(published));
  }
  const next = await (await fetch(api + '/v1/sync/manifest', { headers: authHeaders })).json();
  if (next.revision !== 1 || next.digest !== fingerprint || next.uploadId !== uploadId) {
    throw new Error('Cloud manifest did not advance.');
  }
  const chunk = await (await fetch(api + '/v1/sync/chunk?id=' + uploadId + '&index=0', {
    headers: authHeaders,
  })).json();
  if (chunk.data !== json) throw new Error('Stored cloud workspace differed from the original.');
  const conflict = await post('/v1/sync/start', {
    expectedRevision: 0, chunks: 1, units: json.length, digest: fingerprint,
  });
  if (conflict.status !== 409) throw new Error('Stale upload did not reject with 409.');
  const unauth = await fetch(api + '/v1/sync/manifest');
  if (unauth.status !== 401) throw new Error('Unauthenticated cloud read succeeded.');
  console.log('Live local cloud sync smoke test PASSED.');
}
async function verify() {
  const until = Date.now() + 60000;
  let last = '';
  while (Date.now() < until) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('Wrangler exited before ready. Output:\n' + logs);
    }
    try {
      const response = await fetch(api + '/v1/auth/config', {
        headers: { Origin: frontend },
        signal: AbortSignal.timeout(2000),
      });
      const result = await response.json();
      if (response.status !== 200) throw new Error('Unexpected HTTP ' + response.status);
      if (!result.ready || !result.email) {
        throw new Error('Local authentication configuration incorrect: ' + JSON.stringify(result));
      }
      if (response.headers.get('access-control-allow-origin') !== frontend) {
        throw new Error('Local CORS header is missing or incorrect.');
      }
      await exerciseVerification();
      await exerciseSync();
      console.log('Live local Wrangler auth/config smoke test PASSED:', JSON.stringify({
        ready: result.ready, email: result.email, google: result.google, microsoft: result.microsoft,
      }));
      return;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
      // A real response that shows incorrect config will not self-heal by waiting.
      if (last.startsWith('Local authentication configuration incorrect:')) {
        throw new Error(last + '\nWrangler output:\n' + logs);
      }
    }
    await sleep(350);
  }
  throw new Error('Wrangler local HTTP readiness timeout: ' + last + '\n' + logs);
}
try {
  await verify();
} finally {
  if (child.pid) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* stopped */ }
    }
  }
}
