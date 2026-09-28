import { validateNotebook } from '../features/notebook/library-model.js';
import { validateIndexCards } from '../features/index-cards/tree-model.js';
import { validateWordSearch } from '../features/word-search/library-model.js';

const { ref, watch } = window.Vue;
const STORAGE_KEY = 'dynamic-learner.workspace.v1';
const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

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

function parseWorkspace(text) {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('Backups must be smaller than 32 MB.');
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error('This file is not valid JSON.'); }
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

export function useWorkspace() {
  const state = ref(emptyWorkspace());
  const storageProblem = ref('');
  const revision = ref(0);
  let protectStoredCopy = false;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) state.value = parseWorkspace(saved);
  } catch {
    protectStoredCopy = true;
    storageProblem.value = 'The saved workspace could not be loaded. The stored copy has been left untouched. Download your work before leaving, or upload a valid backup to restore saving.';
  }

  function save() {
    if (protectStoredCopy) return;
    try {
      const text = JSON.stringify(state.value);
      if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('Workspace too large');
      localStorage.setItem(STORAGE_KEY, text);
      storageProblem.value = '';
    } catch {
      storageProblem.value = 'Browser storage is unavailable or full. Your changes are in memory; download a backup before leaving.';
    }
  }

  watch(state, save, { deep: true });

  async function readBackup(file) {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Backups must be smaller than 32 MB.');
    return parseWorkspace(await file.text());
  }

  function replaceWorkspace(value) {
    // Revalidate and copy before touching live state; an invalid upload is never applied.
    const replacement = parseWorkspace(JSON.stringify(value));
    protectStoredCopy = false;
    state.value = replacement;
    revision.value += 1;
    save();
  }

  function downloadBackup() {
    const text = JSON.stringify(state.value);
    // Keep exported files within the same limits as imports.
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

  return { state, revision, storageProblem, readBackup, replaceWorkspace, downloadBackup };
}
