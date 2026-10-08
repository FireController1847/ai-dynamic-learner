// Neutral coordination: features register their own warning; app workflows ask before leaving.
const guards = new Set<() => boolean>();
export function registerLeaveGuard(guard: () => boolean): () => void {
  guards.add(guard);
  return () => { guards.delete(guard); };
}
export function requestLeave(): boolean {
  for (const guard of guards) if (!guard()) return false;
  return true;
}
