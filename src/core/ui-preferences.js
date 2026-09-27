export function readNumberPreference(key) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeNumberPreference(key, value) {
  try { localStorage.setItem(key, String(Math.round(value))); }
  catch { /* UI preferences are best-effort only. */ }
}

export function clearPreference(key) {
  try { localStorage.removeItem(key); }
  catch { /* UI preferences are best-effort only. */ }
}
