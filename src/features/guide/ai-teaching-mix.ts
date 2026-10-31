import { TEACHING_BLOCK_KINDS, type TeachingBlockKind } from './teaching-block-factory.ts';

export type TeachingWeights = Record<TeachingBlockKind, number>;
export type TeachingMixMode = 'ai' | 'custom';
export const DEFAULT_TEACHING_WEIGHTS: TeachingWeights = {
  explanation: 20, example: 14, parameterized: 10, comparison: 8, table: 8,
  sequence: 8, diagram: 8, exploration: 6, 'guided-practice': 10, check: 5, connection: 3,
};
export const TEACHING_TYPES = TEACHING_BLOCK_KINDS.map(item => item.kind);

/** Follows Review's percentage balancing: edits keep 100% without enabling disabled kinds. */
export function rebalanceTeachingWeights(weights: TeachingWeights, edited: TeachingBlockKind, requested: number): TeachingWeights {
  const next: TeachingWeights = validTeachingWeights(weights) ? { ...weights } : { ...DEFAULT_TEACHING_WEIGHTS };
  const others = TEACHING_TYPES.filter(kind => kind !== edited && next[kind] > 0);
  const value = others.length === 0 ? 100 : Number.isFinite(requested)
    ? Math.min(100, Math.max(0, Math.round(requested))) : next[edited];
  let remaining = Math.abs(value - next[edited]);
  const direction = value > next[edited] ? -1 : 1;
  next[edited] = value;
  while (remaining > 0) {
    const available = others.filter(kind => direction < 0 ? next[kind] > 0 : next[kind] < 100);
    if (!available.length) break;
    for (const kind of available) {
      if (!remaining) break;
      const change = Math.min(remaining, direction < 0 ? next[kind] : 100 - next[kind]);
      // One point per pass spreads the adjustment evenly and deterministically.
      next[kind] += direction * Math.min(1, change);
      remaining -= Math.min(1, change);
    }
  }
  return next;
}
export function validTeachingWeights(weights: TeachingWeights): boolean {
  return TEACHING_TYPES.every(kind => Number.isInteger(weights[kind]) && weights[kind] >= 0 && weights[kind] <= 100) &&
    TEACHING_TYPES.reduce((sum, kind) => sum + weights[kind], 0) === 100;
}
export function teachingMixProblem(mode: TeachingMixMode, weights: TeachingWeights, target: number): string {
  if (!Number.isInteger(target) || target < 1 || target > 80) return 'Choose 1–80 teaching blocks overall.';
  if (mode === 'custom' && !validTeachingWeights(weights)) return 'Teaching block percentages must total 100%.';
  return '';
}
/** Largest remainder method, matching Review's mix allocation semantics. */
export function allocateTeachingBlocks(weights: TeachingWeights, count: number): TeachingWeights {
  if (teachingMixProblem('custom', weights, count)) throw new Error('Invalid teaching block mix.');
  const values = { ...weights };
  const fractions = TEACHING_TYPES.map((kind, order) => {
    const n = weights[kind] * count / 100;
    values[kind] = Math.floor(n);
    return { kind, order, fraction: n - values[kind] };
  }).sort((a, b) => b.fraction - a.fraction || a.order - b.order);
  let remaining = count - TEACHING_TYPES.reduce((sum, kind) => sum + values[kind], 0);
  for (const item of fractions) {
    if (!remaining--) break;
    values[item.kind]++;
  }
  return values;
}
