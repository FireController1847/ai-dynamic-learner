import type { AtlasSystemId } from './atlas-model.ts';
import { createId, isValidId } from '../../core/ids.ts';
import { isRecord } from '../../core/validation.ts';

/** Completed outcomes only. An in-progress exercise stays transient. */
export interface AnatomyIdentificationAttempt {
  id: string;
  systemId: AtlasSystemId;
  sectionId: string;
  sectionTitle: string;
  scope: string;
  score: number;
  total: number;
  completedAt: number;
}
export interface AnatomyModel {
  items: [];
  attempts: AnatomyIdentificationAttempt[];
}
export const emptyAnatomy = (): AnatomyModel => ({ items: [], attempts: [] });

export function newAnatomyAttempt(
  systemId: AtlasSystemId, sectionId: string, sectionTitle: string,
  scope: string, score: number, total: number,
): AnatomyIdentificationAttempt {
  return { id: createId(), systemId, sectionId, sectionTitle, scope,
    score, total, completedAt: Date.now() };
}
export function validateAnatomy(value: unknown): asserts value is AnatomyModel {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length !== 0 ||
      !Array.isArray(value.attempts) || Object.keys(value)
        .some(key => !['items', 'attempts'].includes(key))) {
    throw new Error('Saved Anatomy results have an invalid structure.');
  }
  const ids = new Set<string>();
  for (const attempt of value.attempts) {
    if (!isRecord(attempt) || Object.keys(attempt).some(key =>
      !['id', 'systemId', 'sectionId', 'sectionTitle', 'scope', 'score',
        'total', 'completedAt'].includes(key)) ||
        typeof attempt.id !== 'string' || !isValidId(attempt.id)
        || ids.has(attempt.id) ||
        !['skeletal', 'muscular', 'nervous', 'endocrine', 'cardiovascular',
          'integumentary', 'lymphatic', 'respiratory', 'digestive',
          'urinary', 'reproductive'].includes(String(attempt.systemId)) ||
        typeof attempt.sectionId !== 'string' || !attempt.sectionId ||
        attempt.sectionId.length > 160 ||
        typeof attempt.sectionTitle !== 'string' || !attempt.sectionTitle ||
        attempt.sectionTitle.length > 160 ||
        typeof attempt.scope !== 'string' || !attempt.scope ||
        attempt.scope.length > 200 ||
        (typeof attempt.total !== 'number' || !Number.isSafeInteger(attempt.total)) || Number(attempt.total) < 1 ||
        (typeof attempt.score !== 'number' || !Number.isSafeInteger(attempt.score)) || Number(attempt.score) < 0 ||
        Number(attempt.score) > Number(attempt.total) ||
        (typeof attempt.completedAt !== 'number' || !Number.isSafeInteger(attempt.completedAt)) ||
        Number(attempt.completedAt) < 0 || Number(attempt.completedAt) > 8640000000000000) {
      throw new Error('A saved Anatomy identification result is invalid.');
    }
    ids.add(attempt.id);
  }
}

/** Backward-compatible boundary for pre-history Anatomy model shapes.
 * Missing history means no attempts have been recorded yet; a malformed
 * *present* history still fails validation and is never silently discarded.
 */
export function normalizeAnatomy(value: unknown): AnatomyModel {
  if (isRecord(value) && !Object.hasOwn(value, 'attempts')) {
    const migrated = { ...value, attempts: [] };
    validateAnatomy(migrated);
    return migrated;
  }
  validateAnatomy(value);
  return value;
}
