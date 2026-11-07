import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { accountApiRequest } from './auth-provider.ts';
import type { AccountSessionController } from './auth-session.ts';
import { emptyWorkspace, parseWorkspace } from './workspace-format.ts';
import type { WorkspaceController } from './workspace.ts';

// Snapshots are immutable after publication. The server advances a per-account
// revision with CAS; a conflicting device never silently overwrites another.
const CHUNK_UNITS = 64 * 1024;
const MAX_CHUNKS = 2048;
const LINK_PREFIX = 'dynamic-learner.cloud-sync.v1.';
const PENDING_PREFIX = 'dynamic-learner.cloud-sync.pending.v1.';

export type CloudSyncStatus = 'off' | 'checking' | 'syncing' | 'synced' | 'conflict' | 'error';

type RemoteManifest = {
  revision: number;
  uploadId: string | null;
  chunks: number;
  units: number;
  digest: string | null;
  updatedAt: number;
};
type LocalLink = { remoteRevision: number; digest: string };
type SavedSnapshot = { json: string; workspaceId: string; authoredRevision: number };

function linkKey(accountId: string, workspaceId: string): string {
  return LINK_PREFIX + accountId + '.' + workspaceId;
}
function pendingKey(accountId: string): string {
  return PENDING_PREFIX + accountId;
}
function validDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}
function readLink(accountId: string, workspaceId: string): LocalLink | null {
  try {
    const saved = localStorage.getItem(linkKey(accountId, workspaceId));
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    if (typeof value.remoteRevision !== 'number' ||
      !Number.isSafeInteger(value.remoteRevision) || value.remoteRevision < 1 ||
      !validDigest(value.digest)) return null;
    return { remoteRevision: value.remoteRevision, digest: value.digest };
  } catch { return null; }
}
function writeLink(accountId: string, workspaceId: string, link: LocalLink): void {
  // A failure to persist a link means the device cannot track remote conflicts
  // reliably. Do not claim that synchronization is enabled in that case.
  localStorage.setItem(linkKey(accountId, workspaceId), JSON.stringify(link));
}
function isPending(accountId: string): boolean {
  try { return localStorage.getItem(pendingKey(accountId)) === '1'; }
  catch { return false; }
}
function markPending(accountId: string): void {
  localStorage.setItem(pendingKey(accountId), '1');
}
function clearPending(accountId: string): void {
  localStorage.removeItem(pendingKey(accountId));
}
function emptyLearningData(text: string): boolean {
  // Never replace a non-empty guest workspace or statistics with cloud data.
  const data = parseWorkspace(text);
  if (Object.values(data.features).some(feature => feature.items.length > 0)) return false;
  return JSON.stringify(data.statistics) === JSON.stringify(emptyWorkspace().statistics);
}
async function digest(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const result = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function validManifest(value: RemoteManifest): void {
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 ||
    (value.revision > 0 && (
      !value.uploadId || !/^[a-f0-9-]{36}$/.test(value.uploadId) ||
      !Number.isSafeInteger(value.chunks) || value.chunks < 1 || value.chunks > MAX_CHUNKS ||
      !Number.isSafeInteger(value.units) || value.units < 1 ||
      value.units > MAX_CHUNKS * CHUNK_UNITS || !validDigest(value.digest)
    ))) {
    throw new Error('The cloud service returned invalid workspace metadata.');
  }
}
async function getManifest(): Promise<RemoteManifest> {
  const manifest = await accountApiRequest<RemoteManifest>('/v1/sync/manifest');
  validManifest(manifest);
  return manifest;
}
async function download(manifest: RemoteManifest, onProgress: (index: number) => void): Promise<string> {
  validManifest(manifest);
  if (manifest.revision === 0 || !manifest.uploadId || !manifest.digest) {
    throw new Error('No cloud workspace is available.');
  }
  const chunks: string[] = [];
  for (let index = 0; index < manifest.chunks; index++) {
    const response = await accountApiRequest<{ data: unknown }>(
      '/v1/sync/chunk?id=' + encodeURIComponent(manifest.uploadId) + '&index=' + index,
    );
    if (typeof response.data !== 'string' || !response.data.length ||
      response.data.length > CHUNK_UNITS) throw new Error('The cloud workspace contains an invalid chunk.');
    chunks.push(response.data);
    onProgress(index + 1);
  }
  const json = chunks.join('');
  if (json.length !== manifest.units || (await digest(json)) !== manifest.digest) {
    throw new Error('The cloud workspace failed integrity verification; your local copy is unchanged.');
  }
  parseWorkspace(json);
  return json;
}
async function upload(json: string, expectedRevision: number,
  fingerprint: string, onProgress: (index: number, total: number) => void): Promise<number> {
  const count = Math.ceil(json.length / CHUNK_UNITS);
  if (!count || count > MAX_CHUNKS) {
    throw new Error('This workspace exceeds the cloud snapshot size limit. Local data has not been changed.');
  }
  const created = await accountApiRequest<{ uploadId: string }>('/v1/sync/start', {
    expectedRevision, chunks: count, units: json.length, digest: fingerprint,
  });
  if (!/^[a-f0-9-]{36}$/.test(created.uploadId)) {
    throw new Error('The cloud service returned an invalid upload identifier.');
  }
  for (let index = 0; index < count; index += 4) {
    const batch = [];
    for (let part = index; part < Math.min(index + 4, count); part++) {
      batch.push(accountApiRequest('/v1/sync/chunk', {
        uploadId: created.uploadId, index: part,
        data: json.slice(part * CHUNK_UNITS, (part + 1) * CHUNK_UNITS),
      }));
    }
    await Promise.all(batch);
    onProgress(Math.min(index + 4, count), count);
  }
  const result = await accountApiRequest<{ revision: number }>('/v1/sync/publish', {
    uploadId: created.uploadId,
  });
  if (!Number.isSafeInteger(result.revision) || result.revision !== expectedRevision + 1) {
    throw new Error('The server returned an unexpected cloud revision.');
  }
  return result.revision;
}

export function useCloudSync(session: AccountSessionController, workspace: WorkspaceController) {
  const status = ref<CloudSyncStatus>('off');
  const message = ref('Sign in to enable cloud synchronization.');
  const lastSyncedAt = ref<string | null>(null);
  let timer: number | undefined;
  let polling: number | undefined;
  let running = false;
  let disposed = false;
  let retryAfter = 0;

  function accountId(): string | null {
    const state = session.state.value;
    return state.status === 'authenticated' ? state.account.id : null;
  }
  function schedule(ms = 1000) {
    if (disposed) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = window.setTimeout(() => { timer = undefined; void synchronize(); }, ms);
  }
  function setSynced() {
    status.value = 'synced';
    lastSyncedAt.value = new Date().toISOString();
    message.value = 'Cloud sync is on. Your saved workspace is backed up and checked for changes automatically.';
  }
  function ensureStillSignedIn(id: string): void {
    if (disposed || accountId() !== id) {
      throw new Error('The signed-in account changed during synchronization.');
    }
  }
  async function synchronize(): Promise<void> {
    if (running || disposed) return;
    const id = accountId();
    if (!id) {
      status.value = 'off';
      message.value = 'Sign in to enable cloud synchronization.';
      return;
    }
    if (!workspace.ready.value || workspace.needsReconcile.value ||
        workspace.compatibility.value?.mode !== 'normal') {
      status.value = 'error';
      message.value = 'Cloud sync is paused until the local workspace is safely loaded and saved.';
      return;
    }
    if (Date.now() < retryAfter) return;
    running = true;
    status.value = 'checking';
    message.value = 'Checking cloud workspace…';
    try {
      if (session.autoSyncAccountId.value === id) markPending(id);
      const remote = await getManifest();
      ensureStillSignedIn(id);
      const local: SavedSnapshot = await workspace.cloudSnapshot();
      const localDigest = await digest(local.json);
      const linked = readLink(id, local.workspaceId);
      const pending = isPending(id);

      if (!linked && !pending && remote.revision === 0) {
        status.value = 'off';
        message.value = 'Cloud sync is available for this workspace but has not been enabled.';
        return;
      }
      if (!linked && remote.revision > 0) {
        if (!emptyLearningData(local.json)) {
          status.value = 'conflict';
          message.value = 'This account already has a cloud workspace, and this device has separate local work. Neither has been overwritten. Download a local backup before choosing how to combine them.';
          return;
        }
        status.value = 'syncing';
        message.value = 'Restoring cloud workspace to this empty device…';
        const json = await download(remote, done => {
          message.value = 'Restoring cloud workspace (' + done + '/' + remote.chunks + ' parts)…';
        });
        ensureStillSignedIn(id);
        const current = await workspace.cloudSnapshot();
        if (await digest(current.json) !== localDigest || current.workspaceId !== local.workspaceId) {
          throw new Error('The local workspace changed while downloading. No cloud content was applied.');
        }
        await workspace.replaceWorkspace(parseWorkspace(json));
        const restored = await workspace.cloudSnapshot();
        writeLink(id, restored.workspaceId, { remoteRevision: remote.revision, digest: await digest(restored.json) });
        if (pending) clearPending(id);
        session.autoSyncAccountId.value = null;
        setSynced();
        return;
      }
      if (linked && remote.revision !== linked.remoteRevision) {
        if (remote.revision < linked.remoteRevision || localDigest !== linked.digest) {
          status.value = 'conflict';
          message.value = 'Both this device and the cloud changed. Sync is paused to protect both copies; no changes were overwritten.';
          return;
        }
        status.value = 'syncing';
        message.value = 'Updating this device from the cloud…';
        const json = await download(remote, done => {
          message.value = 'Receiving cloud changes (' + done + '/' + remote.chunks + ')…';
        });
        ensureStillSignedIn(id);
        const current = await workspace.cloudSnapshot();
        if (current.workspaceId !== local.workspaceId ||
            (await digest(current.json)) !== localDigest) {
          throw new Error('Local edits appeared during the download. The cloud copy was not applied.');
        }
        await workspace.replaceWorkspace(parseWorkspace(json));
        const restored = await workspace.cloudSnapshot();
        writeLink(id, restored.workspaceId, { remoteRevision: remote.revision, digest: await digest(restored.json) });
        setSynced();
        return;
      }
      if (linked && localDigest === linked.digest) {
        setSynced();
        return;
      }
      status.value = 'syncing';
      message.value = 'Uploading saved workspace to your account…';
      const revision = await upload(local.json, remote.revision, localDigest, (done, total) => {
        message.value = 'Uploading workspace (' + done + '/' + total + ' parts)…';
      });
      ensureStillSignedIn(id);
      writeLink(id, local.workspaceId, { remoteRevision: revision, digest: localDigest });
      clearPending(id);
      session.autoSyncAccountId.value = null;
      setSynced();
      // New edits made during upload are still local and must be uploaded next.
      schedule(1500);
    } catch (cause) {
      status.value = 'error';
      message.value = (cause instanceof Error ? cause.message : 'Cloud workspace synchronization failed.') +
        ' Your local data remains available.';
      retryAfter = Date.now() + 15000;
    } finally {
      running = false;
    }
  }
  function enable() {
    const id = accountId();
    if (!id) return;
    try {
      markPending(id);
      session.autoSyncAccountId.value = id;
      retryAfter = 0;
      schedule(0);
    } catch {
      status.value = 'error';
      message.value = 'This browser cannot save the cloud sync setting. Check local storage permissions.';
    }
  }
  function retry() {
    retryAfter = 0;
    schedule(0);
  }

  watch(() => [
    session.state.value.status === 'authenticated' ? session.state.value.account.id : null,
    session.autoSyncAccountId.value,
    workspace.ready.value,
    workspace.committedRevision.value,
    workspace.revision.value,
    workspace.needsReconcile.value,
  ], () => {
    if (disposed) return;
    const id = accountId();
    if (!id) {
      status.value = 'off';
      message.value = 'Sign in to enable cloud synchronization.';
    }
    // Avoid re-entry while a remote restore is in progress; it will schedule
    // another check when revisions change.
    schedule(2500);
  }, { immediate: true });

  onMounted(() => {
    polling = window.setInterval(() => { if (!running) schedule(0); }, 45000);
  });
  onBeforeUnmount(() => {
    disposed = true;
    if (timer !== undefined) clearTimeout(timer);
    if (polling !== undefined) clearInterval(polling);
  });
  return { status, message, lastSyncedAt, enable, retry };
}
export type CloudSyncController = ReturnType<typeof useCloudSync>;
