import type { Workspace } from '../workspace-format.ts';

type Dictionary = Record<string, unknown>;

/**
 * Merge a committed workspace snapshot into the existing Vue reactive tree.
 *
 * Keep object and array identities for matching saved IDs so an editor in
 * another tab can see changes without having its component, focus, scroll
 * position or local UI state destroyed by a full workspace replacement.
 * Changes are only applied after the local observer has finished all writes.
 *
 * This is not a concurrent text merge: overlapping unsaved edits are still
 * rejected by the IndexedDB record CAS and remain exportable as drafts.
 */
export function applyWorkspaceSnapshot(current: Workspace, saved: Workspace): void {
  // Opening a document in one tab must not navigate another tab away from
  // what its user is working on. Preserve local selection while applying the
  // shared content, unless the selected entry was deleted remotely.
  const selected = Object.entries(current.features).flatMap(([app, model]) =>
    Object.entries(model).filter(([key, value]) =>
      key.startsWith('lastSelected') && typeof value === 'string'
    ).map(([key, value]) => ({ app, key, id: value as string })));
  merge(current, saved);
  for (const { app, key, id } of selected) {
    const feature = (current.features as unknown as Dictionary)[app];
    if (!isObject(feature)) continue;
    if (containsEntry(feature.items, id)) feature[key] = id;
  }
}

function containsEntry(items: unknown, id: string): boolean {
  if (!Array.isArray(items)) return false;
  return items.some(item => isObject(item) && (
    item.id === id || containsEntry(item.children, id)
  ));
}

function isObject(value: unknown): value is Dictionary {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function copy(value: unknown): unknown {
  // Validated Workspace models and IndexedDB rows are JSON-compatible.
  return structuredClone(value);
}

function objectId(value: unknown): string | null {
  if (!isObject(value)) return null;
  return typeof value.id === 'string' ? value.id : null;
}

function mergeArray(existing: unknown[], incoming: readonly unknown[]): void {
  const existingIds = existing.map(objectId);
  const incomingIds = incoming.map(objectId);
  const keyed = [...existingIds, ...incomingIds].every(id => id !== null) &&
    new Set(existingIds).size === existingIds.length &&
    new Set(incomingIds).size === incomingIds.length;
  if (keyed) {
    const previous = new Map(existing.map(item => [objectId(item)!, item]));
    const ordered = incoming.map(item => {
      const old = previous.get(objectId(item)!);
      if (isObject(old) && isObject(item)) {
        mergeObject(old, item);
        return old;
      }
      return copy(item);
    });
    // Keep the array itself and individual items stable, including their
    // ordering, when the remote change was only to an item's content.
    if (ordered.length !== existing.length ||
        ordered.some((item, index) => item !== existing[index])) {
      existing.splice(0, existing.length, ...ordered);
    }
    return;
  }
  for (let index = 0; index < incoming.length; index++) {
    if (index >= existing.length) existing.push(copy(incoming[index]));
    else mergeValue(existing, index, incoming[index]);
  }
  existing.length = incoming.length;
}

function mergeValue(target: Dictionary | unknown[], key: string | number, incoming: unknown): void {
  const previous = (target as Dictionary)[key];
  if (Array.isArray(previous) && Array.isArray(incoming)) {
    mergeArray(previous, incoming);
  } else if (isObject(previous) && isObject(incoming)) {
    mergeObject(previous, incoming);
  } else if (!Object.is(previous, incoming)) {
    (target as Dictionary)[key] = copy(incoming);
  }
}

function mergeObject(target: Dictionary, incoming: Dictionary): void {
  for (const key of Object.keys(target)) {
    if (!Object.hasOwn(incoming, key)) delete target[key];
  }
  for (const [key, value] of Object.entries(incoming)) {
    mergeValue(target, key, value);
  }
}

function merge(current: Workspace, saved: Workspace) {
  mergeObject(current as unknown as Dictionary, saved as unknown as Dictionary);
}
