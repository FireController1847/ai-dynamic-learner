import type { TipsPreferences } from './types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function localStorageOrNull(): Storage | null {
  try { return window.localStorage; }
  catch { return null; }
}

export function readTipsPreferences(storageKey: string, storage = localStorageOrNull()): TipsPreferences {
  try {
    const value: unknown = JSON.parse(storage?.getItem(storageKey) ?? '{}');
    const stored = isRecord(value) ? value : {};
    return {
      enabled: stored.enabled !== false,
      seen: isRecord(stored.seen) ? { ...stored.seen } : {},
    };
  } catch {
    return { enabled: true, seen: {} };
  }
}

export function writeTipsPreferences(storageKey: string, preferences: TipsPreferences, storage = localStorageOrNull()) {
  try { storage?.setItem(storageKey, JSON.stringify(preferences)); }
  catch { /* TIPS preferences are best-effort only. */ }
}
