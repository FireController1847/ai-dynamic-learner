import { isRecord } from '../core/validation.ts';

// Profile identity is intentionally separate from the learning workspace and its backups.
// A future account provider can replace this adapter without changing the profile view.
export interface LocalProfile {
  displayName: string;
  about: string;
}

export const PROFILE_STORAGE_KEY = 'dynamic-learner.profile.v1';
export const PROFILE_NAME_LIMIT = 64;
export const PROFILE_ABOUT_LIMIT = 500;

export function emptyLocalProfile(): LocalProfile {
  return { displayName: 'Local learner', about: '' };
}

export function readLocalProfile(): LocalProfile {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (stored === null) return emptyLocalProfile();
    const value: unknown = JSON.parse(stored);
    if (!isRecord(value) || value.version !== 1 ||
      typeof value.displayName !== 'string' || !value.displayName.trim() ||
      value.displayName.length > PROFILE_NAME_LIMIT ||
      typeof value.about !== 'string' || value.about.length > PROFILE_ABOUT_LIMIT) {
      return emptyLocalProfile();
    }
    return { displayName: value.displayName, about: value.about };
  } catch {
    // Local preferences must never block the app or the study workspace.
    return emptyLocalProfile();
  }
}

export function writeLocalProfile(profile: LocalProfile): void {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
    version: 1,
    displayName: profile.displayName,
    about: profile.about,
  }));
}
