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

export type CloudSyncStatus = 'loading' | 'off' | 'pending' | 'checking' | 'syncing' | 'synced' | 'conflict' | 'error';

type RemoteManifest = {
  revision: number;
  uploadId: string | null;
  chunks: number;
  units: number;
  digest: string | null;
  updatedAt: number;
};
type LocalLink = { remoteRevision: number; digest: string };
type SavedSnapshot = {
  json: string; workspaceId: string; authoredRevision: number; commitSequence: number
};

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
  fingerprint: string, onProgress: (index: number, total: number) => void): Promise<{ revision: number; uploadId: string }> {
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
  return { revision: result.revision, uploadId: created.uploadId };
}

export function useCloudSync(session: AccountSessionController, workspace: WorkspaceController) {
  // The manifest is read exactly once per signed-in account at initialization.
  // All passive change indicators compare local IndexedDB commit counters with
  // this cached state. There is no network poll and no automatic transfer.
  const status = ref<CloudSyncStatus>('loading');
  const message = ref('Checking account…');
  const lastSyncedAt = ref<string | null>(null);
  const handoffRequired = ref(false);
  const cooldownSeconds = ref(0);
  let cachedManifest: RemoteManifest | null = null;
  let conflictManifest: RemoteManifest | null = null;
  let baseline: (SavedSnapshot & { digest: string }) | null = null;
  let activeAccount: string | null = null;
  let initialLoadStarted = false;
  let generation = 0;
  let running = false;
  let disposed = false;
  let cooldownUntil = 0;
  let cooldownTimer: number | undefined;

  function accountId(): string | null {
    const state = session.state.value;
    return state.status === 'authenticated' ? state.account.id : null;
  }
  function ensureStillSignedIn(id: string): void {
    if (disposed || id !== accountId() || id !== activeAccount) {
      throw new Error('The signed-in account changed during synchronization.');
    }
  }
  function cooldownKey(id: string): string {
    return 'dynamic-learner.cloud-sync.cooldown.v1.' + id;
  }
  function loadCooldown(id: string): void {
    try {
      const value = Number(sessionStorage.getItem(cooldownKey(id)));
      cooldownUntil = Number.isFinite(value) && value > Date.now() ? value : 0;
    } catch { cooldownUntil = 0; }
    updateCooldown();
  }
  function updateCooldown(): void {
    cooldownSeconds.value = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  }
  function startCooldown(id: string): void {
    cooldownUntil = Date.now() + 30_000;
    try { sessionStorage.setItem(cooldownKey(id), String(cooldownUntil)); }
    catch { /* Still enforce cooldown in memory. */ }
    updateCooldown();
  }
  function updateBaseline(snapshot: SavedSnapshot, fingerprint: string): void {
    baseline = { ...snapshot, digest: fingerprint };
  }
  function noTransfer(messageText: string): void {
    handoffRequired.value = false;
    conflictManifest = null;
    status.value = 'synced';
    lastSyncedAt.value = new Date().toISOString();
    message.value = messageText;
  }
  function recordSynced(id: string, snapshot: SavedSnapshot, fingerprint: string,
    manifest: RemoteManifest, messageText: string): void {
    if (manifest.revision < 1) throw new Error('The cloud workspace does not have a published revision.');
    writeLink(id, snapshot.workspaceId, { remoteRevision: manifest.revision, digest: fingerprint });
    clearPending(id);
    session.autoSyncAccountId.value = null;
    cachedManifest = manifest;
    updateBaseline(snapshot, fingerprint);
    noTransfer(messageText);
    updatePassiveStatus();
  }
  function isLocallyDirty(): boolean {
    return !!baseline && (
      workspace.committedRevision.value !== baseline.commitSequence ||
      !workspace.ready.value || workspace.needsReconcile.value
    );
  }
  function updatePassiveStatus(): void {
    const id = accountId();
    if (!id || !cachedManifest || !baseline || running ||
      status.value === 'loading' || status.value === 'checking' ||
      status.value === 'conflict' || status.value === 'error') return;
    if (workspace.needsReconcile.value || workspace.compatibility.value?.mode !== 'normal') {
      status.value = 'error';
      message.value = 'Local changes need attention before cloud synchronization.';
      return;
    }
    const cloud = cachedManifest;
    const link = readLink(id, baseline.workspaceId);
    if (isLocallyDirty()) {
      status.value = 'pending';
      message.value = 'Local changes waiting to sync. Cloud status is based on the last check.';
    } else if (cloud.revision === 0) {
      status.value = 'pending';
      message.value = 'No cloud workspace yet. Press Sync to upload this device’s data.';
    } else if (baseline.digest === cloud.digest) {
      status.value = 'synced';
      message.value = 'Workspace matched the cloud at the last check. Press Sync to check again.';
    } else if (!link || link.remoteRevision !== cloud.revision ||
               link.digest !== baseline.digest) {
      status.value = 'pending';
      message.value = 'Local and cloud copies may differ. Press Sync to review.';
    } else {
      status.value = 'pending';
      message.value = 'Changes may need synchronization. Press Sync to check.';
    }
  }
  async function initialize(id: string): Promise<void> {
    if (initialLoadStarted || disposed || id !== activeAccount || !workspace.ready.value) return;
    initialLoadStarted = true;
    const current = generation;
    status.value = 'loading';
    message.value = 'Loading cloud sync status…';
    try {
      // Only one cloud GET and one local durable snapshot per account load.
      const remote = await getManifest();
      ensureStillSignedIn(id);
      const local = await workspace.cloudSnapshot();
      const fingerprint = await digest(local.json);
      if (current !== generation) return;
      cachedManifest = remote;
      updateBaseline(local, fingerprint);
      status.value = 'pending';
      updatePassiveStatus();
    } catch (cause) {
      if (current === generation && id === accountId()) {
        status.value = 'error';
        message.value = (cause instanceof Error ? cause.message : 'Could not load cloud sync status.') +
          ' Local data remains available. Press Sync to retry.';
      }
    }
  }
  function resetForAccount(id: string | null): void {
    generation += 1;
    activeAccount = id;
    initialLoadStarted = false;
    cachedManifest = null;
    conflictManifest = null;
    baseline = null;
    handoffRequired.value = false;
    lastSyncedAt.value = null;
    if (!id) {
      cooldownUntil = 0;
      updateCooldown();
      status.value = session.state.value.status === 'checking' ? 'loading' : 'off';
      message.value = session.state.value.status === 'checking'
        ? 'Checking account…' : 'Sign in to synchronize this workspace.';
      return;
    }
    loadCooldown(id);
    status.value = 'loading';
    message.value = 'Loading cloud sync status…';
    if (workspace.ready.value) void initialize(id);
  }
  function showConflict(remote: RemoteManifest, reason: string): void {
    conflictManifest = remote;
    cachedManifest = remote;
    handoffRequired.value = true;
    status.value = 'conflict';
    message.value = reason;
  }
  async function uploadSnapshot(id: string, local: SavedSnapshot,
    fingerprint: string, remote: RemoteManifest): Promise<void> {
    status.value = 'syncing';
    message.value = 'Uploading workspace…';
    const publishedResult = await upload(local.json, remote.revision, fingerprint, (done, total) => {
      message.value = 'Uploading workspace (' + done + '/' + total + ' parts)…';
    });
    ensureStillSignedIn(id);
    // The server's published revision is authoritative; we already know all
    // other manifest fields for the immutable snapshot we just uploaded.
    const published: RemoteManifest = {
      revision: publishedResult.revision, uploadId: publishedResult.uploadId,
      chunks: Math.ceil(local.json.length / CHUNK_UNITS),
      units: local.json.length, digest: fingerprint, updatedAt: Math.floor(Date.now() / 1000),
    };
    recordSynced(id, local, fingerprint, published, 'Workspace uploaded. Cloud sync is up to date as of this check.');
  }
  async function downloadSnapshot(id: string, local: SavedSnapshot,
    remote: RemoteManifest, localFingerprint: string): Promise<void> {
    status.value = 'syncing';
    message.value = 'Downloading cloud workspace…';
    const json = await download(remote, done => {
      message.value = 'Downloading cloud workspace (' + done + '/' + remote.chunks + ' parts)…';
    });
    ensureStillSignedIn(id);
    // After downloading, recheck the live head before local replacement.
    const latest = await getManifest();
    ensureStillSignedIn(id);
    if (latest.revision !== remote.revision ||
        latest.digest !== remote.digest || latest.uploadId !== remote.uploadId) {
      showConflict(latest, 'The cloud workspace changed while downloading. Choose which copy to keep.');
      return;
    }
    const current = await workspace.cloudSnapshot();
    if (current.workspaceId !== local.workspaceId ||
        current.commitSequence !== local.commitSequence ||
        (await digest(current.json)) !== localFingerprint) {
      showConflict(latest, 'Local changes appeared during download. Choose which copy to keep.');
      return;
    }
    await workspace.useCloudWorkspace(parseWorkspace(json), local);
    const restored = await workspace.cloudSnapshot();
    const restoredDigest = await digest(restored.json);
    recordSynced(id, restored, restoredDigest, latest,
      'Cloud workspace loaded on this device. Up to date as of this check.');
  }
  /**
   * The only normal cloud-refresh entry point. Never called by watchers,
   * timers, navigation, or page mount. The cooldown is per account and client.
   */
  async function sync(): Promise<void> {
    const id = accountId();
    if (!id || disposed || running || handoffRequired.value) return;
    updateCooldown();
    if (cooldownSeconds.value > 0) return;
    if (!workspace.ready.value || workspace.needsReconcile.value ||
        workspace.compatibility.value?.mode !== 'normal') {
      status.value = 'error';
      message.value = 'Local changes need to be saved before synchronizing.';
      return;
    }
    running = true;
    startCooldown(id);
    status.value = 'checking';
    message.value = 'Checking the latest cloud workspace…';
    try {
      const remote = await getManifest();
      ensureStillSignedIn(id);
      cachedManifest = remote;
      const local = await workspace.cloudSnapshot();
      const fingerprint = await digest(local.json);
      const linked = readLink(id, local.workspaceId);

      if (remote.revision > 0 && remote.digest === fingerprint) {
        recordSynced(id, local, fingerprint, remote, 'No changes needed. Checked just now.');
      } else if (remote.revision === 0) {
        await uploadSnapshot(id, local, fingerprint, remote);
      } else if (linked && linked.remoteRevision === remote.revision &&
          linked.digest === remote.digest) {
        await uploadSnapshot(id, local, fingerprint, remote);
      } else if ((linked && remote.revision > linked.remoteRevision &&
                  fingerprint === linked.digest) ||
                (!linked && emptyLearningData(local.json))) {
        await downloadSnapshot(id, local, remote, fingerprint);
      } else {
        showConflict(remote, 'Local and cloud workspaces differ. Choose which copy to keep.');
      }
    } catch (cause) {
      if (id === accountId()) {
        status.value = 'error';
        message.value = (cause instanceof Error ? cause.message : 'Cloud synchronization failed.') +
          ' Your local work remains available.';
      }
    } finally {
      running = false;
      updatePassiveStatus();
    }
  }
  async function downloadLocal(): Promise<void> {
    try {
      await workspace.downloadBackup();
      if (status.value === 'conflict') {
        message.value = 'Local backup download started. Confirm the file is saved before replacing anything.';
      }
    } catch (cause) {
      message.value = (cause instanceof Error ? cause.message : 'Could not export local workspace.') +
        ' Local work was not changed.';
      throw cause;
    }
  }
  /**
   * Explicit choice during a manually discovered conflict.
   * Keeping local data publishes a new complete snapshot, never force-writes
   * without the server's expected-revision CAS check.
   */
  async function keepLocalWorkspace(): Promise<void> {
    const id = accountId();
    if (!id || running || status.value !== 'conflict' || !conflictManifest) return;
    running = true;
    status.value = 'syncing';
    message.value = 'Checking cloud revision before replacing it…';
    try {
      const expected = conflictManifest;
      const local = await workspace.cloudSnapshot();
      const fingerprint = await digest(local.json);
      const latest = await getManifest();
      ensureStillSignedIn(id);
      if (latest.revision !== expected.revision ||
          latest.digest !== expected.digest || latest.uploadId !== expected.uploadId) {
        showConflict(latest, 'Another device changed the cloud copy. Review your choice and confirm again.');
        return;
      }
      if (latest.revision > 0 && latest.digest === fingerprint) {
        recordSynced(id, local, fingerprint, latest, 'Both copies match. No upload needed.');
        return;
      }
      await uploadSnapshot(id, local, fingerprint, latest);
    } catch (cause) {
      if (id === accountId()) {
        status.value = 'conflict';
        handoffRequired.value = true;
        message.value = (cause instanceof Error ? cause.message : 'Could not replace cloud data.') +
          ' Your local workspace has not been erased.';
      }
    } finally {
      running = false;
      updatePassiveStatus();
    }
  }
  /** Explicit choice to replace the selected local data with cloud contents. */
  async function useCloudWorkspace(): Promise<void> {
    const id = accountId();
    if (!id || running || status.value !== 'conflict' || !conflictManifest) return;
    running = true;
    const expected = conflictManifest;
    status.value = 'syncing';
    message.value = 'Checking cloud revision before replacing local data…';
    let localReplaced = false;
    try {
      const local = await workspace.cloudSnapshot();
      const fingerprint = await digest(local.json);
      const latest = await getManifest();
      ensureStillSignedIn(id);
      if (latest.revision !== expected.revision ||
          latest.digest !== expected.digest || latest.uploadId !== expected.uploadId) {
        showConflict(latest, 'Another device changed the cloud copy. Review your choice and confirm again.');
        return;
      }
      const json = await download(latest, done => {
        message.value = 'Downloading cloud workspace (' + done + '/' + latest.chunks + ' parts)…';
      });
      ensureStillSignedIn(id);
      const afterDownload = await getManifest();
      if (afterDownload.revision !== latest.revision ||
          afterDownload.digest !== latest.digest ||
          afterDownload.uploadId !== latest.uploadId) {
        showConflict(afterDownload, 'The cloud workspace changed during download. Review your choice again.');
        return;
      }
      await workspace.useCloudWorkspace(parseWorkspace(json), local);
      localReplaced = true;
      const restored = await workspace.cloudSnapshot();
      recordSynced(id, restored, await digest(restored.json), afterDownload,
        'Cloud workspace loaded on this device. Up to date as of this check.');
    } catch (cause) {
      if (id === accountId()) {
        status.value = localReplaced ? 'error' : 'conflict';
        handoffRequired.value = !localReplaced;
        message.value = (cause instanceof Error ? cause.message : 'Could not replace local workspace.') +
          (localReplaced ? ' Local replacement may have completed. Reload before retrying.'
            : ' Local workspace replacement was not completed.');
      }
    } finally {
      running = false;
      updatePassiveStatus();
    }
  }
  // Only the signed-in account transition triggers a manifest read.
  watch(accountId, id => {
    if (activeAccount === id && initialLoadStarted) return;
    resetForAccount(id);
  }, { immediate: true });
  watch(() => [
    workspace.ready.value, workspace.committedRevision.value,
    workspace.needsReconcile.value,
  ], () => {
    if (disposed || !activeAccount) return;
    if (!initialLoadStarted && workspace.ready.value) void initialize(activeAccount);
    else updatePassiveStatus();
  });
  onMounted(() => {
    cooldownTimer = window.setInterval(updateCooldown, 1000);
  });
  onBeforeUnmount(() => {
    disposed = true;
    generation++;
    if (cooldownTimer !== undefined) clearInterval(cooldownTimer);
  });
  return {
    status, message, lastSyncedAt, handoffRequired, cooldownSeconds,
    sync, downloadLocal, keepLocalWorkspace, useCloudWorkspace,
  };
}
export type CloudSyncController = ReturnType<typeof useCloudSync>;
