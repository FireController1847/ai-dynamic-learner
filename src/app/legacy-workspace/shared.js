import { createId, isValidId } from '../../core/ids.js';

export function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export function recoverName(value, fallback, report) {
  if (typeof value === 'string' && value.trim() && value.length <= 120) return value;
  report.repaired += 1;
  return fallback;
}

export function claimId(value, ids, report) {
  if (isValidId(value) && !ids.has(value)) {
    ids.add(value);
    return value;
  }
  let replacement;
  do replacement = createId();
  while (ids.has(replacement));
  ids.add(replacement);
  report.repaired += 1;
  return replacement;
}

export function optionalDisplay(value, validate, report) {
  const candidate = asObject(value);
  if (!candidate) {
    report.skipped += 1;
    return null;
  }
  try {
    validate(candidate);
    return candidate;
  } catch {
    report.skipped += 1;
    return null;
  }
}
