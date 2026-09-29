import { validateNotebook } from '../features/notebook/library-model.js';
import { validateIndexCards } from '../features/index-cards/tree-model.js';
import { validateWordSearch } from '../features/word-search/library-model.js';
import { SQLiteWorkspaceStorage } from '../core/storage/sqlite-client.js';
import { readLegacyWorkspace, clearLegacyWorkspace } from './legacy-workspace.js';

const { ref, toRaw, watch } = window.Vue;
const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
const SAVE_DELAY_MS = 80;

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

function parseWorkspace(text) {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('Backups must be smaller than 32 MB.');
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

export function useWorkspace() {
  const state = ref(emptyWorkspace());
  const ready = ref(false);
  const storageProblem = ref('');
  const migrationNotice = ref('');
  const revision = ref(0);
  const storage = new SQLiteWorkspaceStorage();
  let savingEnabled = false;
  let saveTimer = null;

  function storageError(problem) {
    storageProblem.value = `SQLite storage is unavailable. Changes remain in memory; download a backup before leaving. ${problem?.message || ''}`.trim();
  }

  async function persistNow() {
    if (!savingEnabled) return;
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      await storage.saveWorkspace(toRaw(state.value));
      storageProblem.value = '';
    } catch (problem) {
      storageError(problem);
    }
  }

  function scheduleSave() {
    if (!savingEnabled) return;
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persistNow();
    }, SAVE_DELAY_MS);
  }

  watch(state, scheduleSave, { deep: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistNow();
  });

  async function initialize() {
    try {
      await storage.initialize();
      const saved = await storage.loadWorkspace();
      if (saved) {
        state.value = validateWorkspace(saved);
        savingEnabled = true;
        return;
      }

      const legacy = readLegacyWorkspace();
      if (legacy.status === 'unreadable') {
        storageProblem.value = `${legacy.error} Upload a valid backup to replace it and enable SQLite saving.`;
        return;
      }

      const initial = legacy.status === 'ready'
        ? validateWorkspace(legacy.workspace)
        : emptyWorkspace();
      await storage.saveWorkspace(initial);
      state.value = initial;
      savingEnabled = true;

      if (legacy.status === 'ready') {
        migrationNotice.value = migrationSummary(legacy.report);
        try { clearLegacyWorkspace(); }
        catch { /* SQLite is already authoritative; a leftover legacy copy is harmless. */ }
      }
    } catch (problem) {
      storageError(problem);
    } finally {
      ready.value = true;
    }
  }

  initialize();

  async function readBackup(file) {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Backups must be smaller than 32 MB.');
    return parseWorkspace(await file.text());
  }

  async function replaceWorkspace(value) {
    const replacement = validateWorkspace(structuredClone(value));
    await storage.saveWorkspace(replacement);
    state.value = replacement;
    savingEnabled = true;
    storageProblem.value = '';
    migrationNotice.value = '';
    revision.value += 1;
    try { clearLegacyWorkspace(); }
    catch { /* The confirmed SQLite replacement is still complete. */ }
  }

  function downloadBackup() {
    const text = JSON.stringify(toRaw(state.value));
    // JSON remains the portable backup interchange format, not the live storage format.
    parseWorkspace(text);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `dynamic-learner-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    state,
    ready,
    revision,
    storageProblem,
    migrationNotice,
    readBackup,
    replaceWorkspace,
    downloadBackup,
    persistNow,
  };
}
