// Cross-feature study activity is transient, never part of workspace storage.
const activeSessions = new Set<symbol>();
const subscribers = new Set<(active: boolean) => void>();

export function reportStudySession(token: symbol, active: boolean): void {
  const before = activeSessions.size > 0;
  if (active) activeSessions.add(token);
  else activeSessions.delete(token);
  if (before !== (activeSessions.size > 0)) {
    for (const subscriber of subscribers) subscriber(activeSessions.size > 0);
  }
}

export function subscribeStudySessions(subscriber: (active: boolean) => void): () => void {
  subscribers.add(subscriber);
  subscriber(activeSessions.size > 0);
  return () => { subscribers.delete(subscriber); };
}
