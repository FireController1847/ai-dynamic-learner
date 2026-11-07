import { activeSession, db, now, rateLimit } from './auth/db';
import { ApiError, readJson, respond } from './auth/http';
import type { RuntimeEnv } from './auth/types';

// Snapshots are chunked so D1 never needs to hold an entire workspace in one
// row or Worker invocation. A manifest pointer is published only after all
// chunks are stored and checked. Earlier snapshots remain recoverable.
const CHUNK_UNITS = 64 * 1024;
const MAX_CHUNKS = 2048;
const MAX_UNITS = CHUNK_UNITS * MAX_CHUNKS;
const UPLOAD_TTL_SECONDS = 6 * 3600;

function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ApiError(400, 'Invalid workspace synchronization metadata.');
  }
  return value;
}
function uploadId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/.test(value)) {
    throw new ApiError(400, 'Invalid upload identifier.');
  }
  return value;
}
async function accountId(request: Request, env: RuntimeEnv): Promise<string> {
  const session = await activeSession(env, request);
  if (!session) throw new ApiError(401, 'Sign in to synchronize your workspace.');
  return session.account.id;
}
type Head = {
  revision: number; upload_id: string | null; updated_at: number;
};
type Upload = {
  account_id: string; expected_revision: number; chunk_count: number;
  total_units: number; digest: string; created_at: number; published_at: number | null;
};
async function head(env: RuntimeEnv, account: string): Promise<Head> {
  const found = await db(env).prepare(
    'SELECT revision,upload_id,updated_at FROM cloud_sync_heads WHERE account_id=?'
  ).bind(account).first<Head>();
  return found ?? { revision: 0, upload_id: null, updated_at: 0 };
}
export async function syncGetManifest(request: Request, env: RuntimeEnv): Promise<Response> {
  const account = await accountId(request, env);
  const current = await head(env, account);
  if (!current.upload_id) {
    return respond({ revision: current.revision, uploadId: null, chunks: 0, units: 0, digest: null,
      updatedAt: current.updated_at });
  }
  const upload = await db(env).prepare(
    'SELECT chunk_count,total_units,digest FROM cloud_sync_uploads WHERE id=? AND account_id=?'
  ).bind(current.upload_id, account).first<{ chunk_count: number; total_units: number; digest: string }>();
  if (!upload) throw new ApiError(503, 'The published cloud workspace is missing.');
  return respond({ revision: current.revision, uploadId: current.upload_id,
    chunks: upload.chunk_count, units: upload.total_units, digest: upload.digest, updatedAt: current.updated_at });
}
export async function syncGetChunk(request: Request, env: RuntimeEnv): Promise<Response> {
  const account = await accountId(request, env);
  const url = new URL(request.url);
  const id = uploadId(url.searchParams.get('id'));
  const index = integer(Number(url.searchParams.get('index')), 0, MAX_CHUNKS - 1);
  // Access to old published snapshots remains possible briefly while another
  // device publishes a newer revision.
  const upload = await db(env).prepare(
    'SELECT account_id,expected_revision,chunk_count,total_units,digest,created_at,published_at ' +
    'FROM cloud_sync_uploads WHERE id=? AND account_id=?'
  ).bind(id, account).first<Upload>();
  if (!upload || upload.published_at === null || index >= upload.chunk_count) {
    throw new ApiError(404, 'Cloud workspace chunk not found.');
  }
  const chunk = await db(env).prepare(
    'SELECT data FROM cloud_sync_chunks WHERE upload_id=? AND chunk_index=?'
  ).bind(id, index).first<{ data: string }>();
  if (!chunk) throw new ApiError(503, 'A cloud workspace chunk is missing.');
  return respond({ data: chunk.data });
}
export async function syncStart(request: Request, env: RuntimeEnv): Promise<Response> {
  const account = await accountId(request, env);
  const input = await readJson(request);
  const expected = integer(input.expectedRevision, 0, Number.MAX_SAFE_INTEGER - 1);
  const chunks = integer(input.chunks, 1, MAX_CHUNKS);
  const units = integer(input.units, 1, MAX_UNITS);
  if (typeof input.digest !== 'string' || !/^[a-f0-9]{64}$/.test(input.digest)) {
    throw new ApiError(400, 'Invalid cloud workspace digest.');
  }
  if (chunks * CHUNK_UNITS < units || (chunks - 1) * CHUNK_UNITS >= units) {
    throw new ApiError(400, 'Invalid cloud workspace chunk count.');
  }
  await rateLimit(env, request, 'cloud-sync-start', account, 20, 3600);
  await db(env).prepare(
    'INSERT OR IGNORE INTO cloud_sync_heads(account_id,revision,upload_id,updated_at) VALUES(?,0,NULL,0)'
  ).bind(account).run();
  const current = await head(env, account);
  if (current.revision !== expected) throw new ApiError(409, 'The cloud workspace changed on another device.');
  const id = crypto.randomUUID();
  await db(env).prepare(
    'INSERT INTO cloud_sync_uploads(id,account_id,expected_revision,chunk_count,total_units,digest,created_at,published_at) ' +
    'VALUES(?,?,?,?,?,?,?,NULL)'
  ).bind(id, account, expected, chunks, units, input.digest, now()).run();
  return respond({ uploadId: id }, 201);
}
export async function syncChunk(request: Request, env: RuntimeEnv): Promise<Response> {
  const account = await accountId(request, env);
  const input = await readJson(request, 512 * 1024);
  const id = uploadId(input.uploadId);
  const index = integer(input.index, 0, MAX_CHUNKS - 1);
  if (typeof input.data !== 'string' || !input.data.length || input.data.length > CHUNK_UNITS) {
    throw new ApiError(400, 'Invalid cloud workspace chunk.');
  }
  const upload = await db(env).prepare(
    'SELECT account_id,expected_revision,chunk_count,total_units,digest,created_at,published_at ' +
    'FROM cloud_sync_uploads WHERE id=? AND account_id=?'
  ).bind(id, account).first<Upload>();
  if (!upload || upload.published_at !== null || upload.created_at < now() - UPLOAD_TTL_SECONDS ||
      index >= upload.chunk_count) {
    throw new ApiError(409, 'The workspace upload is no longer active.');
  }
  // Do not allow a chunk to be edited after publication. This upload is
  // account-scoped and is not exposed in another account's manifest.
  await db(env).prepare(
    'INSERT INTO cloud_sync_chunks(upload_id,chunk_index,data,units) VALUES(?,?,?,?) ' +
    'ON CONFLICT(upload_id,chunk_index) DO UPDATE SET data=excluded.data,units=excluded.units'
  ).bind(id, index, input.data, input.data.length).run();
  return respond({ stored: true });
}
export async function syncPublish(request: Request, env: RuntimeEnv): Promise<Response> {
  const account = await accountId(request, env);
  const input = await readJson(request);
  const id = uploadId(input.uploadId);
  const upload = await db(env).prepare(
    'SELECT account_id,expected_revision,chunk_count,total_units,digest,created_at,published_at ' +
    'FROM cloud_sync_uploads WHERE id=? AND account_id=?'
  ).bind(id, account).first<Upload>();
  if (!upload || upload.published_at !== null || upload.created_at < now() - UPLOAD_TTL_SECONDS) {
    throw new ApiError(409, 'The workspace upload is no longer active.');
  }
  const saved = await db(env).prepare(
    'SELECT COUNT(*) AS parts,COALESCE(SUM(units),0) AS units FROM cloud_sync_chunks WHERE upload_id=?'
  ).bind(id).first<{ parts: number; units: number }>();
  if (!saved || saved.parts !== upload.chunk_count || saved.units !== upload.total_units) {
    throw new ApiError(400, 'Cloud workspace upload is incomplete.');
  }
  // Compare-and-swap: a newer workspace must never be silently overwritten.
  const published = await db(env).prepare(
    'UPDATE cloud_sync_heads SET revision=revision+1,upload_id=?,updated_at=? ' +
    'WHERE account_id=? AND revision=? RETURNING revision'
  ).bind(id, now(), account, upload.expected_revision).first<{ revision: number }>();
  if (!published) throw new ApiError(409, 'The cloud workspace changed on another device.');
  await db(env).prepare('UPDATE cloud_sync_uploads SET published_at=? WHERE id=?')
    .bind(now(), id).run();
  // Keep older published versions for a short recovery window. Never delete
  // unpublished uploads in progress or the current head's data.
  try {
    const obsolete = await db(env).prepare(
      'SELECT id FROM cloud_sync_uploads WHERE account_id=? AND published_at IS NOT NULL ' +
      'AND id<>? AND published_at<? LIMIT 20'
    ).bind(account, id, now() - 7 * 24 * 3600).all<{ id: string }>();
    for (const row of obsolete.results) {
      await db(env).prepare('DELETE FROM cloud_sync_uploads WHERE id=?').bind(row.id).run();
    }
  } catch { /* Snapshot was already published; cleanup failure isn't sync failure. */ }
  return respond({ revision: published.revision });
}
