import { asObject } from './legacy-workspace/shared.js';
import { migrateLegacyNotebook } from './legacy-workspace/notebook.js';
import { migrateLegacyIndexCards } from './legacy-workspace/index-cards.js';
import { migrateLegacyWordSearch } from './legacy-workspace/word-search.js';

export const LEGACY_WORKSPACE_KEY = 'dynamic-learner.workspace.v1';
export const LEGACY_WORKSPACE_ARCHIVE_KEY = 'dynamic-learner.workspace.legacy-archive.v1';

export function readLegacyWorkspace() {
  let text;
  try {
    text = localStorage.getItem(LEGACY_WORKSPACE_KEY);
  } catch (problem) {
    return {
      status: 'unreadable',
      error: problem?.message || 'Legacy browser storage is unavailable.',
    };
  }
  if (text === null) return { status: 'none' };

  let source;
  try {
    source = JSON.parse(text);
  } catch {
    return {
      status: 'unreadable',
      error: 'The legacy workspace exists but is not valid JSON. It has been left untouched.',
    };
  }

  const features = asObject(source)?.features;
  if (!asObject(features)) {
    return {
      status: 'unreadable',
      error: 'The legacy workspace does not contain a recognizable feature collection. It has been left untouched.',
    };
  }

  const report = { recovered: 0, repaired: 0, skipped: 0 };
  return {
    status: 'ready',
    report,
    workspace: {
      format: 'dynamic-learner',
      version: 1,
      features: {
        notebook: migrateLegacyNotebook(features.notebook, report),
        'index-cards': migrateLegacyIndexCards(features['index-cards'], report),
        'word-search': migrateLegacyWordSearch(features['word-search'], report),
      },
    },
  };
}

export function archiveLegacyWorkspace() {
  const value = localStorage.getItem(LEGACY_WORKSPACE_KEY);
  if (value === null) return false;

  // Copy first. If quota prevents the archive write, keep the original source
  // rather than deleting the only legacy recovery copy.
  localStorage.setItem(LEGACY_WORKSPACE_ARCHIVE_KEY, value);
  localStorage.removeItem(LEGACY_WORKSPACE_KEY);
  return true;
}

export function clearLegacyWorkspace() {
  localStorage.removeItem(LEGACY_WORKSPACE_KEY);
}
