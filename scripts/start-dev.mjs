/**
 * Single-command development launcher. No remote migrations or deployment.
 * npm start -> local SQLite-backed D1 -> local Worker -> frontend.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'api');
const npmCli = process.env.npm_execpath;
const requiredSecrets = ['AUTH_PEPPER', 'AUTH_RATE_SECRET'];

export function parsePort(raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid development port: ' + String(raw));
  }
  return port;
}

/** Never rotate existing local secrets, especially a pepper used for password hashes. */
export function ensureLocalDevSecrets(file) {
  const exists = existsSync(file);
  const original = exists ? readFileSync(file, 'utf8') : '';
  const additions = [];
  for (const key of requiredSecrets) {
    const pattern = new RegExp('^\\s*' + key + '\\s*=([^\\r\\n]*)', 'gm');
    const matches = [...original.matchAll(pattern)];
    if (matches.length > 1) throw new Error(key + ' is duplicated in api/.dev.vars.');
    if (matches.length) {
      const value = matches[0][1].trim().replace(/^(['"])(.*)\1$/, '$2');
      if (value.length < 32 || /^(replace|example|your_)/i.test(value)) {
        throw new Error(key + ' is invalid in api/.dev.vars. Fix it without rotating an existing account pepper.');
      }
    } else {
      additions.push(key + '=' + randomBytes(48).toString('base64url'));
    }
  }
  if (additions.length) {
    const addedContent = (original && !original.endsWith('\n') ? '\n' : '') + additions.join('\n') + '\n';
    if (exists) appendFileSync(file, addedContent, 'utf8');
    else writeFileSync(file, addedContent, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  }
  return additions.map(line => line.slice(0, line.indexOf('=')));
}

export function migrationArgs() {
  // Explicit --local flag: never touch the Cloudflare-hosted database.
  return ['exec', '--', 'wrangler', 'd1', 'migrations', 'apply', 'dynlearn-data', '--local'];
}

export function workerArgs(frontPort, apiPort) {
  return ['run', 'dev', '--', '--local', '--ip', '127.0.0.1', '--port', String(apiPort),
    '--var', 'FRONTEND_ORIGIN:http://127.0.0.1:' + frontPort,
    '--var', 'API_ORIGIN:http://127.0.0.1:' + apiPort,
    '--var', 'LOCAL_MAIL_PREVIEW:1'];
}

function npmSync(args, cwd) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd, stdio: 'inherit', env: { ...process.env, CI: '1' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Local setup command failed: npm ' + args[0]);
}

function npmChild(args, cwd, env) {
  return spawn(process.execPath, [npmCli, ...args], {
    cwd, env, stdio: 'inherit', detached: process.platform !== 'win32',
  });
}

function terminate(child, signal) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      // Terminate npm and its spawned Wrangler/webpack descendants together.
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error?.code !== 'ESRCH') console.warn('[dev] Could not stop a child process:', error);
  }
}

async function waitFor(url, child, timeout, checkJson = false) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('Development server exited before becoming ready: ' + url);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok && (!checkJson || (await response.json()).status === 'ok')) return;
    } catch { /* Server is still starting/compiling. */ }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error('Development server did not become ready: ' + url);
}

export async function start() {
  if (!npmCli) throw new Error('Run this launcher through npm start.');
  const frontPort = parsePort(process.env.PORT, 3000);
  const apiPort = parsePort(process.env.DL_AUTH_API_PORT, 8787);
  if (frontPort === apiPort) throw new Error('Frontend and Worker ports must be different.');
  if (!existsSync(join(root, 'node_modules', 'webpack-cli', 'package.json'))) {
    throw new Error('Install frontend dependencies once with npm ci.');
  }
  if (!existsSync(join(apiDir, 'node_modules', 'wrangler', 'package.json'))) {
    console.log('[dev] Installing Worker dependencies (first run only)...');
    npmSync(['ci'], apiDir);
  }
  const added = ensureLocalDevSecrets(join(apiDir, '.dev.vars'));
  if (added.length) console.log('[dev] Added local-only secrets: ' + added.join(', '));
  console.log('[dev] Applying local D1 migrations; production is untouched...');
  npmSync(migrationArgs(), apiDir);

  let worker;
  let frontend;
  let stopping = false;
  const shutdown = (signal = 'SIGTERM') => {
    if (stopping) return;
    stopping = true;
    terminate(frontend, signal);
    terminate(worker, signal);
  };
  process.once('SIGINT', () => { process.exitCode = 130; shutdown('SIGINT'); });
  process.once('SIGTERM', () => { process.exitCode = 143; shutdown('SIGTERM'); });
  try {
    const apiUrl = 'http://127.0.0.1:' + apiPort;
    const frontUrl = 'http://127.0.0.1:' + frontPort;
    console.log('[dev] Starting local Worker: ' + apiUrl);
    worker = npmChild(workerArgs(frontPort, apiPort), apiDir, process.env);
    worker.once('exit', code => {
      if (!stopping) {
        console.error('[dev] Worker exited.');
        process.exitCode = code || 1;
        shutdown();
      }
    });
    worker.once('error', error => {
      if (!stopping) {
        console.error('[dev] Worker startup failed:', error.message);
        process.exitCode = 1;
        shutdown();
      }
    });
    await waitFor(apiUrl + '/v1/health', worker, 60000, true);
    if (stopping) return;

    console.log('[dev] Starting local frontend: ' + frontUrl);
    frontend = npmChild(['run', 'start:frontend'], root, {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(frontPort),
      DL_AUTH_API_ORIGIN: apiUrl,
    });
    frontend.once('exit', code => {
      if (!stopping) {
        console.error('[dev] Frontend exited.');
        process.exitCode = code || 1;
        shutdown();
      }
    });
    frontend.once('error', error => {
      if (!stopping) {
        console.error('[dev] Frontend startup failed:', error.message);
        process.exitCode = 1;
        shutdown();
      }
    });
    const profileUrl = frontUrl + '/profile/';
    await waitFor(profileUrl, frontend, 90000);
    if (stopping) return;
    console.log('[dev] Ready: ' + profileUrl);
    console.log('[dev] Local D1 and .dev.vars persist between runs. Press Ctrl+C to stop both.');
  } catch (error) {
    process.exitCode = 1;
    shutdown();
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch(error => {
    console.error('[dev] ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
