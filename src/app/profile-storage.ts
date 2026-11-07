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


export const PROFILE_SCOPED_PREFIX = 'dynamic-learner.profile.identity.v1:';

export function profileStorageKey(identityId: string): string {
  if (!/^[\\w-]{1,128}$/.test(identityId)) throw new Error('Invalid local identity.');
  return PROFILE_SCOPED_PREFIX + identityId;
}

function parseLocalProfile(stored: string | null): LocalProfile {
  if (stored === null) return emptyLocalProfile();
  try {
    const value: unknown = JSON.parse(stored);
    if (!isRecord(value) || value.version !== 1 ||
      typeof value.displayName !== 'string' || !value.displayName.trim() ||
      value.displayName.length > PROFILE_NAME_LIMIT ||
      typeof value.about !== 'string' || value.about.length > PROFILE_ABOUT_LIMIT) {
      return emptyLocalProfile();
    }
    const email = value.email === undefined ? '' : value.email;
    const phone = value.phone === undefined ? '' : value.phone;
    const avatarDataUrl = value.avatarDataUrl === undefined ? null : value.avatarDataUrl;
    if (typeof email !== 'string' || email.length > PROFILE_EMAIL_LIMIT ||
      typeof phone !== 'string' || phone.length > PROFILE_PHONE_LIMIT ||
      !validAvatar(avatarDataUrl)) return emptyLocalProfile();
    return { displayName: value.displayName, about: value.about, email, phone, avatarDataUrl };
  } catch { return emptyLocalProfile(); }
}

export interface ProfileRepository {
  read(identityId: string): LocalProfile;
  write(identityId: string, profile: LocalProfile): void;
  transferGuest(identityId: string): void;
  clear(identityId: string): void;
}

export const localProfileRepository: ProfileRepository = {
  read(identityId) {
    try {
      const stored = localStorage.getItem(profileStorageKey(identityId));
      return parseLocalProfile(stored ?? (identityId === 'guest' ? localStorage.getItem(PROFILE_STORAGE_KEY) : null));
    } catch { return emptyLocalProfile(); }
  },
  write(identityId, profile) {
    if (!profile.displayName.trim() || profile.displayName.length > PROFILE_NAME_LIMIT ||
      profile.about.length > PROFILE_ABOUT_LIMIT ||
      profile.email.length > PROFILE_EMAIL_LIMIT ||
      profile.phone.length > PROFILE_PHONE_LIMIT ||
      !validAvatar(profile.avatarDataUrl)) {
      throw new Error('Invalid profile data.');
    }
    localStorage.setItem(profileStorageKey(identityId), JSON.stringify({
      version: 1, displayName: profile.displayName, about: profile.about,
      email: profile.email, phone: profile.phone, avatarDataUrl: profile.avatarDataUrl,
    }));
  },
  transferGuest(identityId) {
    const profile = this.read('guest');
    this.write(identityId, profile);
    localStorage.removeItem(profileStorageKey('guest'));
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  },
  clear(identityId) {
    localStorage.removeItem(profileStorageKey(identityId));
  },
};
