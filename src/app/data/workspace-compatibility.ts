import type { Workspace } from '../workspace-format.ts';
import { hydrateWorkspace, workspaceRows, WORKSPACE_RECORD_STORES } from './workspace-mapping.ts';
import { dataPrimaryKey, type DataStoreName, type IndexedRow } from '../../core/data/indexeddb.ts';

/**
 * The database is the source of truth. This module only projects its known,
 * independently owned features for the running build. It never repairs,
 * deletes, normalizes, or writes a record.
 */
export const OWNED_FEATURES = [
  'notebook', 'todo-list', 'solve-it-grid', 'index-cards',
  'word-search', 'crossword', 'guide', 'knowledge-check', 'anatomy',
] as const;

type FeatureName = typeof OWNED_FEATURES[number];
const knownFeatures = new Set<string>(OWNED_FEATURES);
// Anatomy has saved identification attempts, not generic app-activity counters.
const statApps = new Set<string>([...OWNED_FEATURES.filter(app =>
  app !== 'solve-it-grid' && app !== 'anatomy'), 'calculator']);
const featureStores: Partial<Record<DataStoreName, FeatureName>> = {
  notebookDocuments: 'notebook',
  todoLists: 'todo-list', todoSections: 'todo-list', todoTasks: 'todo-list',
  solveItTaskSets: 'solve-it-grid', solveItTasks: 'solve-it-grid',
  indexCardSets: 'index-cards', indexCards: 'index-cards',
  wordSearches: 'word-search', wordSearchGames: 'word-search',
  crosswords: 'crossword', crosswordGames: 'crossword',
  guides: 'guide', guideSessions: 'guide',
  reviewSets: 'knowledge-check', reviewQuestions: 'knowledge-check',
};
const collectionScopes = new Set<string>([
  ...OWNED_FEATURES.filter(app => app !== 'anatomy'),
  'index-cards:cards', 'knowledge-check:questions',
  'todo-list:sections', 'todo-list:tasks', 'solve-it-grid:tasks',
]);

export interface WorkspaceCompatibility {
  mode: 'normal' | 'compatible' | 'recovery';
  databaseVersion: number;
  unsupportedFeatures: string[];
  protectedFeatures: string[];
  issues: string[];
  /** A newer physical schema or damaged known content must never be modified. */
  readOnly: boolean;
}

/** Owner of an ordinary row, or null for non-feature metadata. */
export function rowOwner(store: DataStoreName, row: IndexedRow): string | null {
  if (store === 'featureState' || store === 'libraryNodes' || store === 'collections' ||
      store === 'statisticsApps' || store === 'statisticsEntries') {
    return typeof row.app === 'string' ? row.app.split(':')[0]! : null;
  }
  return featureStores[store] ?? null;
}

export function rowIsUnknown(store: DataStoreName, row: IndexedRow): boolean {
  if (store === 'featureState' || store === 'libraryNodes') {
    return typeof row.app === 'string' && !knownFeatures.has(row.app);
  }
  if (store === 'collections') {
    return typeof row.app === 'string' && !collectionScopes.has(row.app);
  }
  if (store === 'statisticsApps' || store === 'statisticsEntries') {
    return typeof row.app === 'string' && !statApps.has(row.app);
  }
  return false;
}

function project(raw: ReadonlyMap<DataStoreName, IndexedRow[]>, workspaceId: string,
  retained: ReadonlySet<string>, includeStatistics: boolean): Map<DataStoreName, IndexedRow[]> {
  const rows = new Map<DataStoreName, IndexedRow[]>();
  for (const store of WORKSPACE_RECORD_STORES) {
    const selected = (raw.get(store) ?? []).filter(row => {
      if (store === 'statisticsMeta' || store === 'statisticsApps' || store === 'statisticsEntries') {
        return includeStatistics && !rowIsUnknown(store, row);
      }
      if (rowIsUnknown(store, row)) return false;
      const owner = rowOwner(store, row);
      return owner === null || retained.has(owner);
    });
    rows.set(store, selected);
  }
  // Only absent, genuinely empty feature roots may be synthesized in memory.
  // Missing collections for a nonempty library remain a validation failure.
  const roots = rows.get('collections') ?? [];
  const nodes = rows.get('libraryNodes') ?? [];
  for (const app of OWNED_FEATURES) {
    if (app === 'todo-list') {
      const hasLists = (rows.get('todoLists') ?? []).length > 0;
      if (!hasLists && !roots.some(row => row.app === app && row.parentId === '@root')) {
        roots.push({ workspaceId, app, parentId: '@root', children: [] });
      }
      continue;
    }
    // Anatomy stores completed identification history in featureState only.
    // Neither it nor Solve-it Grid needs a fabricated library collection root.
    if (app === 'solve-it-grid' || app === 'anatomy') continue;
    if (nodes.some(row => row.app === app)) continue;
    if (!roots.some(row => row.app === app && row.parentId === '@root')) {
      roots.push({ app, parentId: '@root', children: [] });
    }
  }
  rows.set('collections', roots);
  return rows;
}

async function hydrate(raw: ReadonlyMap<DataStoreName, IndexedRow[]>, id: string,
  retained: ReadonlySet<string>, stats: boolean): Promise<Workspace> {
  const data = project(raw, id, retained, stats);
  const reader = { all: async <T>(store: DataStoreName) => (data.get(store) ?? []) as T[] };
  return hydrateWorkspace(reader, id);
}

export async function compatibleWorkspace(raw: ReadonlyMap<DataStoreName, IndexedRow[]>,
  id: string, databaseVersion: number, supportedVersion: number): Promise<{
    workspace: Workspace; compatibility: WorkspaceCompatibility;
  }> {
  const unknown = new Set<string>();
  for (const [store, rows] of raw) {
    for (const row of rows) if (rowIsUnknown(store, row)) {
      unknown.add(typeof row.app === 'string' ? row.app : store);
    }
  }
  const issues: string[] = [];
  const known = new Set<string>(OWNED_FEATURES);
  const newerSchema = databaseVersion > supportedVersion;
  if (newerSchema) issues.push(
    `This database uses schema ${databaseVersion}; this build supports ${supportedVersion}. Editing is disabled.`);
  const unsupportedFeatures = [...unknown].sort();
  // Unknown collection shapes within a known feature cannot safely be edited
  // by an older writer, even if their parent feature still hydrates.
  const unknownKnownScopes = (raw.get('collections') ?? []).some(row =>
    rowIsUnknown('collections', row) && typeof row.app === 'string' &&
    knownFeatures.has(row.app.split(':')[0]!));
  if (unknownKnownScopes) issues.push('A known feature has a newer collection format; editing is disabled.');
  if (unsupportedFeatures.length) issues.push(
    'Data from a newer or unavailable feature is preserved but not shown: ' + unsupportedFeatures.join(', ') + '.');

  try {
    const workspace = await hydrate(raw, id, known, true);
    // Some validators accept forward-compatible properties but the old
    // serializer may not round-trip them. Detect such fields before creating
    // an editable view, rather than dropping them on the next structural save.
    const writable = new Map(workspaceRows(id, workspace).map(row =>
      [row.store + '|' + JSON.stringify(row.key), row.value]));
    let omittedFields = false;
    for (const [store, rows] of raw) {
      if (!WORKSPACE_RECORD_STORES.includes(store)) continue;
      for (const row of rows) {
        if (rowIsUnknown(store, row)) continue;
        try {
          const saved = writable.get(store + '|' + JSON.stringify(dataPrimaryKey(store, row)));
          if (!saved || Object.keys(row).some(key => key !== 'revision' && !Object.hasOwn(saved, key))) {
            omittedFields = true;
          }
        } catch { omittedFields = true; }
      }
    }
    if (omittedFields) issues.push(
      'Some supported records contain fields this build cannot round-trip. Editing is disabled.');
    return { workspace, compatibility: {
      mode: issues.length ? 'compatible' : 'normal', databaseVersion,
      unsupportedFeatures, protectedFeatures: [], issues, readOnly: newerSchema || unknownKnownScopes || omittedFields,
    } };
  } catch (error) {
    // A known feature with damaged or newer fields must not suppress healthy
    // features. Re-hydrate each in isolation to identify a safe read-only view.
    const protectedFeatures: string[] = [];
    for (const feature of OWNED_FEATURES) {
      try { await hydrate(raw, id, new Set([feature]), false); }
      catch { protectedFeatures.push(feature); }
    }
    const visible = new Set(OWNED_FEATURES.filter(app => !protectedFeatures.includes(app)));
    const detail = error instanceof Error ? error.message : String(error);
    issues.push('Some saved content could not be validated: ' + detail);
    if (protectedFeatures.length) issues.push(
      'Protected feature data: ' + protectedFeatures.join(', ') + '.');
    let workspace: Workspace;
    try { workspace = await hydrate(raw, id, visible, true); }
    catch {
      // A broken statistics payload should not prevent displaying healthy
      // learning features. It remains in IDB, never in an editable projection.
      issues.push('Saved statistics could not be loaded; original counters remain preserved.');
      workspace = await hydrate(raw, id, visible, false);
    }
    return { workspace, compatibility: {
      mode: 'recovery', databaseVersion, unsupportedFeatures,
      protectedFeatures, issues, readOnly: true,
    } };
  }
}
