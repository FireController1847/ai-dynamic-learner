/** Version-1 FNV-1a seed hashing plus Mulberry32; stable across supported browsers. */
export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) { state ^= char.codePointAt(0)!; state = Math.imul(state, 16777619); }
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
export function newVariantSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
