/** Narrow an untrusted JSON value before inspecting fields. Arrays are not records. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
