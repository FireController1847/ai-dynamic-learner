export function readNumberPreference(key: string): number | null {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return null;
    const value = Number(stored);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeNumberPreference(key: string, value: number): void {
  try { localStorage.setItem(key, String(Math.round(value))); }
  catch { /* UI preferences are best-effort only. */ }
}

export function clearPreference(key: string): void {
  try { localStorage.removeItem(key); }
  catch { /* UI preferences are best-effort only. */ }
}
