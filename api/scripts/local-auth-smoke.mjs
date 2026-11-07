/**
 * Integration smoke test: runs actual Wrangler HTTP server, not a mocked
 * Worker fetch, to verify the local email preview and CLI variable overrides.
 */
import { spawn } from 'node:child_process';
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
const child = spawn(process.execPath, args, {
  cwd: apiDir, env: { ...process.env, CI: '1' },
  stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
});
let logs = '';
child.stdout.on('data', part => { logs += String(part); logs = logs.slice(-18000); });
child.stderr.on('data', part => { logs += String(part); logs = logs.slice(-18000); });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
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
