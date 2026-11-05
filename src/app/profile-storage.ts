import { isRecord } from '../core/validation.ts';

// Profile identity is intentionally separate from the learning workspace and its backups.
// A future account provider can replace this adapter without changing the profile view.
export interface LocalProfile {
  displayName: string;
  about: string;
  email: string;
  phone: string;
  avatarDataUrl: string | null;
}

export const PROFILE_STORAGE_KEY = 'dynamic-learner.profile.v1';
export const PROFILE_NAME_LIMIT = 64;
export const PROFILE_ABOUT_LIMIT = 500;
export const PROFILE_EMAIL_LIMIT = 254;
export const PROFILE_PHONE_LIMIT = 40;
export const PROFILE_AVATAR_DATA_LIMIT = 300_000;

function validAvatar(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' &&
    value.length <= PROFILE_AVATAR_DATA_LIMIT &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value));
}

export function emptyLocalProfile(): LocalProfile {
  return { displayName: 'Local learner', about: '', email: '', phone: '', avatarDataUrl: null };
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

    // The original v1 profile only had displayName and about.
    const email = value.email === undefined ? '' : value.email;
    const phone = value.phone === undefined ? '' : value.phone;
    const avatarDataUrl = value.avatarDataUrl === undefined ? null : value.avatarDataUrl;
    if (typeof email !== 'string' || email.length > PROFILE_EMAIL_LIMIT ||
      typeof phone !== 'string' || phone.length > PROFILE_PHONE_LIMIT ||
      !validAvatar(avatarDataUrl)) return emptyLocalProfile();

    return { displayName: value.displayName, about: value.about, email, phone, avatarDataUrl };
  } catch {
    // Local preferences must never block the app or the study workspace.
    return emptyLocalProfile();
  }
}

export function writeLocalProfile(profile: LocalProfile): void {
  if (!profile.displayName.trim() || profile.displayName.length > PROFILE_NAME_LIMIT ||
    profile.about.length > PROFILE_ABOUT_LIMIT ||
    profile.email.length > PROFILE_EMAIL_LIMIT ||
    profile.phone.length > PROFILE_PHONE_LIMIT ||
    !validAvatar(profile.avatarDataUrl)) {
    throw new Error('Invalid profile data.');
  }
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
    version: 1,
    displayName: profile.displayName,
    about: profile.about,
    email: profile.email,
    phone: profile.phone,
    avatarDataUrl: profile.avatarDataUrl,
  }));
}
