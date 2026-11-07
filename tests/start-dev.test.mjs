import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureLocalDevSecrets, migrationArgs, parsePort, workerArgs } from '../scripts/start-dev.mjs';

const directories = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function file() {
  const directory = mkdtempSync(join(tmpdir(), 'dynlearn-start-'));
  directories.push(directory);
  return join(directory, '.dev.vars');
}

describe('one-command development startup', () => {
  it('creates unique local secrets once and never rotates them', () => {
    const path = file();
    assert.deepEqual(ensureLocalDevSecrets(path), ['AUTH_PEPPER', 'AUTH_RATE_SECRET']);
    const original = readFileSync(path, 'utf8');
    const secrets = original.trim().split('\n').map(line => line.split('=')[1]);
    assert.equal(secrets.length, 2);
    assert.ok(secrets.every(value => value.length >= 32));
    assert.notEqual(secrets[0], secrets[1]);
    assert.deepEqual(ensureLocalDevSecrets(path), []);
    assert.equal(readFileSync(path, 'utf8'), original);
    if (process.platform !== 'win32') assert.equal(statSync(path).mode & 0o777, 0o600);
  });
  it('preserves existing credentials and fills only missing values', () => {
    const path = file();
    const original = 'RESEND_API_KEY=local-test\nAUTH_PEPPER=abcdefghijklmnopqrstuvwxyz1234567890';
    writeFileSync(path, original);
    assert.deepEqual(ensureLocalDevSecrets(path), ['AUTH_RATE_SECRET']);
    assert.ok(readFileSync(path, 'utf8').startsWith(original + '\n'));
  });
  it('rejects invalid or duplicate secrets without overwriting them', () => {
    const path = file();
    writeFileSync(path, 'AUTH_PEPPER=short\n');
    assert.throws(() => ensureLocalDevSecrets(path), /invalid/);
    assert.equal(readFileSync(path, 'utf8'), 'AUTH_PEPPER=short\n');
    writeFileSync(path, 'AUTH_PEPPER=abcdefghijklmnopqrstuvwxyz1234567890\nAUTH_PEPPER=abcdefghijklmnopqrstuvwxyz1234567890\n');
    assert.throws(() => ensureLocalDevSecrets(path), /duplicated/);
  });
  it('supports separate local ports and never targets remote D1', () => {
    assert.equal(parsePort(undefined, 3000), 3000);
    assert.equal(parsePort('3200', 3000), 3200);
    assert.throws(() => parsePort('invalid', 3000));
    assert.throws(() => parsePort('65536', 3000));
    assert.deepEqual(migrationArgs(), [
      'exec', '--', 'wrangler', 'd1', 'migrations', 'apply', 'dynlearn-data', '--local',
    ]);
    const args = workerArgs(3200, 8888).join(' ');
    assert.match(args, /FRONTEND_ORIGIN:http:\/\/localhost:3200/);
    assert.match(args, /API_ORIGIN:http:\/\/localhost:8888/);
    assert.match(args, /--local/);
    assert.doesNotMatch(args, /--remote|deploy/);
  });
});
