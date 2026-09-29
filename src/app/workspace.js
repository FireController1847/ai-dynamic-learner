import { validateNotebook } from '../features/notebook/library-model.js';
import { validateIndexCards } from '../features/index-cards/tree-model.js';
import { validateWordSearch } from '../features/word-search/library-model.js';
import { SQLiteWorkspaceStorage } from '../core/storage/sqlite-client.js';
import { readLegacyWorkspace, clearLegacyWorkspace } from './legacy-workspace.js';

const { ref, toRaw, watch } = window.Vue;
const MAX_LEGACY_JSON_BACKUP_BYTES = 32 * 1024 * 1024;
const SAVE_DELAY_MS = 250;

function emptyWorkspace() {
  return {
    format: 'dynamic-learner',
    version: 1,
    features: {
      notebook: { items: [] },
      'index-cards': { items: [] },
      'word-search': { items: [] },
    },
  };
}

function validateWorkspace(value) {
  if (!value || value.format !== 'dynamic-learner' || value.version !== 1 ||
      Object.keys(value).some((key) => !['format', 'version', 'features'].includes(key)) ||
      !value.features || !value.features['index-cards'] ||
      Object.keys(value.features).some((key) => !['notebook', 'index-cards', 'word-search'].includes(key))) {
    throw new Error('This is not a supported Dynamic Learner workspace backup (version 1).');
  }
  if (value.features.notebook) validateNotebook(value.features.notebook);
  else value.features.notebook = { items: [] };
  validateIndexCards(value.features['index-cards']);
  if (value.features['word-search']) validateWordSearch(value.features['word-search']);
  else value.features['word-search'] = { items: [] };
  return value;
}

function parseLegacyJsonBackup(text) {
  if (new Blob([text]).size > MAX_LEGACY_JSON_BACKUP_BYTES) {
    throw new Error('Legacy JSON backups must be smaller than 32 MB. Use a SQLite .bak backup for larger workspaces.');
  }
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error('This file is not valid JSON.'); }
  return validateWorkspace(value);
}

function migrationSummary(report) {
  const details = [];
  if (report.repaired) details.push(`${report.repaired} repaired`);
  if (report.skipped) details.push(`${report.skipped} skipped`);
  return `Legacy browser data was migrated into SQLite. ${report.recovered} records were recovered${details.length ? ` (${details.join(', ')})` : ''}.`;
}

function backupFilename() {
  return `dynamic-learner-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
}

export function useWorkspace() {
  const state = ref(emptyWorkspace());
  const initialized = ref(false);
  const ready = ref(false);
  const storageAvailable = ref(false);
  const storageProblem = ref('');
  const migrationNotice = ref('');
  const revision = ref(0);
  const storage = new SQLiteWorkspaceStorage();

  let savingEnabled = false;
  let saveTimer = null;
  let mutationVersion = 0;
  let savedVersion = 0;
  let queuedVersion = -1;
  let queuedOperation = Promise.resolve();
  const pendingWrites = new Set();

  function clearSaveTimer() {
    if (saveTimer === null) return;
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  function saveError(problem) {
    storageProblem.value = `SQLite could not save the latest workspace changes. Keep this tab open while the problem is resolved. ${problem?.message || ''}`.trim();
  }

  function queueSnapshot(snapshot, version) {
    if (queuedVersion === version) return queuedOperation;

    // Post immediately. The Worker serializes operations in message order, which
    // lets lifecycle flushes enter its queue before the page has a chance to close.
    const operation = storage.saveWorkspace(snapshot);
    pendingWrites.add(operation);
    queuedVersion = version;
    queuedOperation = operation.finally(() => {
      pendingWrites.delete(operation);
      if (queuedVersion === version) queuedVersion = -1;
    });

    return queuedOperation.then(() => {
      savedVersion = Math.max(savedVersion, version);
      if (mutationVersion === version) storageProblem.value = '';
    });
  }

  async function waitForPendingWrites() {
    while (pendingWrites.size) {
      await Promise.allSettled([...pendingWrites]);
    }
  }

  async function persistNow({ throwOnError = false } = {}) {
    if (!savingEnabled) return;
    clearSaveTimer();

    const version = mutationVersion;
    if (version <= savedVersion) {
      await waitForPendingWrites();
      return;
    }

    const snapshot = structuredClone(toRaw(state.value));
    try {
      await queueSnapshot(snapshot, version);
    } catch (problem) {
      saveError(problem);
      if (throwOnError) throw problem;
    }
  }

  function scheduleSave() {
    if (!savingEnabled) return;
    mutationVersion += 1;
    clearSaveTimer();
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persistNow();
    }, SAVE_DELAY_MS);
  }

  // Synchronous notification keeps initialization/replacement assignments from
  // being mistaken for user edits while savingEnabled is deliberately false.
  watch(state, scheduleSave, { deep: true, flush: 'sync' });

  function requestLifecycleFlush() {
    if (savingEnabled) persistNow();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') requestLifecycleFlush();
  });
  window.addEventListener('pagehide', requestLifecycleFlush);

  async function initialize() {
    try {
      await storage.initialize();
      storageAvailable.value = true;

      const saved = await storage.loadWorkspace();
      if (saved) {
        state.value = validateWorkspace(saved);
        savingEnabled = true;
        ready.value = true;
        return;
      }

      const legacy = readLegacyWorkspace();
      if (legacy.status === 'unreadable') {
        storageProblem.value = `${legacy.error} Editing is blocked to protect it. Upload a valid backup to replace the workspace.`;
        return;
      }

      const initial = legacy.status === 'ready'
        ? validateWorkspace(legacy.workspace)
        : emptyWorkspace();
      await storage.saveWorkspace(initial);
      state.value = initial;
      savingEnabled = true;
      ready.value = true;

      if (legacy.status === 'ready') {
        migrationNotice.value = migrationSummary(legacy.report);
        try { clearLegacyWorkspace(); }
        catch { /* SQLite is already authoritative; a leftover legacy copy is harmless. */ }
      }
    } catch (problem) {
      if (storageAvailable.value) {
        storageProblem.value = `The saved SQLite workspace could not be loaded safely. Editing is blocked to protect the stored data. Upload a valid backup to replace it. ${problem?.message || ''}`.trim();
      } else {
        storageProblem.value = `Workspace storage could not be opened. If Dynamic Learner is open in another tab or window, close it and reload this page. Saved data has not been replaced. ${problem?.message || ''}`.trim();
      }
    } finally {
      initialized.value = true;
    }
  }

  initialize();

  async function readBackup(file) {
    if (file.name.toLowerCase().endsWith('.bak')) {
      const workspace = await storage.inspectBackup(await file.arrayBuffer());
      return validateWorkspace(workspace);
    }

    if (file.size > MAX_LEGACY_JSON_BACKUP_BYTES) {
      throw new Error('Legacy JSON backups must be smaller than 32 MB. Use a SQLite .bak backup for larger workspaces.');
    }
    return parseLegacyJsonBackup(await file.text());
  }

  async function replaceWorkspace(value) {
    if (!storageAvailable.value) throw new Error('SQLite storage is not available.');
    const replacement = validateWorkspace(structuredClone(value));
    const previousSavingEnabled = savingEnabled;

    savingEnabled = false;
    clearSaveTimer();
    try {
      // Drain snapshots already posted, then place the replacement last.
      await waitForPendingWrites();
      await storage.saveWorkspace(replacement);

      state.value = replacement;
      mutationVersion = 0;
      savedVersion = 0;
      queuedVersion = -1;
      savingEnabled = true;
      ready.value = true;
      storageProblem.value = '';
      migrationNotice.value = '';
      revision.value += 1;

      try { clearLegacyWorkspace(); }
      catch { /* The confirmed SQLite replacement is still complete. */ }
    } catch (problem) {
      savingEnabled = previousSavingEnabled;
      throw problem;
    }
  }

  async function downloadBackup() {
    if (!ready.value) throw new Error('The workspace is not available to back up.');
    await persistNow({ throwOnError: true });
    await waitForPendingWrites();

    const bytes = await storage.exportBackup();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/gzip' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFilename();
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    state,
    initialized,
    ready,
    storageAvailable,
    revision,
    storageProblem,
    migrationNotice,
    readBackup,
    replaceWorkspace,
    downloadBackup,
    persistNow,
  };
}
