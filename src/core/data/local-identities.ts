import { isValidId } from '../ids.ts';

// Local identities are device-only placeholders, NOT authenticated users.
// The server will later supply verified account IDs independently of profile text.
export const GUEST_ID = 'guest';
export const IDENTITY_DIRECTORY_KEY = 'identity-directory';
export const MAX_LOCAL_IDENTITIES = 20;
export const MAX_IDENTITY_LABEL = 64;

export interface LocalIdentity {
  id: string;
  kind: 'guest' | 'local';
  label: string;
  workspaceId: string;
}
export interface IdentityDirectory {
  key: typeof IDENTITY_DIRECTORY_KEY;
  version: 1;
  activeIdentityId: string;
  identities: LocalIdentity[];
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readIdentityDirectory(value: unknown): IdentityDirectory {
  if (!object(value) || value.key !== IDENTITY_DIRECTORY_KEY || value.version !== 1 ||
    !Array.isArray(value.identities) || value.identities.length < 1 ||
    value.identities.length > MAX_LOCAL_IDENTITIES || typeof value.activeIdentityId !== 'string') {
    throw new Error('Local identity directory is damaged or unsupported. Existing data has not been changed.');
  }
  const identities: LocalIdentity[] = [];
  const ids = new Set<string>();
  const workspaces = new Set<string>();
  for (const entry of value.identities) {
    if (!object(entry) || !isValidId(entry.id) ||
      (entry.kind !== 'guest' && entry.kind !== 'local') ||
      (entry.id === GUEST_ID) !== (entry.kind === 'guest') ||
      typeof entry.label !== 'string' || !entry.label.trim() ||
      entry.label.length > MAX_IDENTITY_LABEL || !isValidId(entry.workspaceId) ||
      ids.has(entry.id) || workspaces.has(entry.workspaceId)) {
      throw new Error('Local identity directory contains invalid ownership information.');
    }
    ids.add(entry.id);
    workspaces.add(entry.workspaceId);
    identities.push({
      id: entry.id, kind: entry.kind, label: entry.label, workspaceId: entry.workspaceId,
    });
  }
  if (!ids.has(GUEST_ID) || !ids.has(value.activeIdentityId)) {
    throw new Error('The guest or selected local identity is missing. Stored workspaces were preserved.');
  }
  return { key: IDENTITY_DIRECTORY_KEY, version: 1,
    activeIdentityId: value.activeIdentityId, identities };
}
export function selectedIdentity(directory: IdentityDirectory): LocalIdentity {
  const identity = directory.identities.find(item => item.id === directory.activeIdentityId);
  if (!identity) throw new Error('The active identity is missing.');
  return identity;
}
