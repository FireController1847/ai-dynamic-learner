export type WhiteboardBlockToken = symbol;

type WhiteboardBlockedListener = (blocked: boolean) => void;

const blockers = new Set<WhiteboardBlockToken>();
const listeners = new Set<WhiteboardBlockedListener>();

function notify() {
  const blocked = blockers.size > 0;
  for (const listener of listeners) listener(blocked);
}

export function setWhiteboardBlocked(token: WhiteboardBlockToken, blocked: boolean) {
  const changed = blocked ? !blockers.has(token) : blockers.has(token);
  if (!changed) return;
  if (blocked) blockers.add(token);
  else blockers.delete(token);
  notify();
}

export function subscribeWhiteboardBlocked(listener: WhiteboardBlockedListener) {
  listeners.add(listener);
  listener(blockers.size > 0);
  return () => listeners.delete(listener);
}
