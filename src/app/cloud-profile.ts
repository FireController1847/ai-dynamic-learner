import { onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { accountApiRequest } from './auth-provider.ts';
import type { AccountSessionController } from './auth-session.ts';

export const PROFILE_NAME_LIMIT = 64;
export const PROFILE_ABOUT_LIMIT = 500;
export const PROFILE_EMAIL_LIMIT = 254;
export const PROFILE_PHONE_LIMIT = 40;
export const PROFILE_AVATAR_DATA_LIMIT = 300_000;

export interface CloudProfile {
  displayName: string;
  about: string;
  contactEmail: string;
  phone: string;
  avatarDataUrl: string | null;
}
interface ProfileResponse {
  revision: number;
  updatedAt: number;
  profile: CloudProfile;
}
type ProfileState = 'signed-out' | 'loading' | 'ready' | 'saving' | 'error';

function validProfile(value: unknown): value is CloudProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<CloudProfile>;
  return typeof profile.displayName === 'string' && !!profile.displayName.trim() &&
    profile.displayName.length <= PROFILE_NAME_LIMIT &&
    typeof profile.about === 'string' && profile.about.length <= PROFILE_ABOUT_LIMIT &&
    typeof profile.contactEmail === 'string' && profile.contactEmail.length <= PROFILE_EMAIL_LIMIT &&
    typeof profile.phone === 'string' && profile.phone.length <= PROFILE_PHONE_LIMIT &&
    (profile.avatarDataUrl === null || (typeof profile.avatarDataUrl === 'string' &&
      profile.avatarDataUrl.length <= PROFILE_AVATAR_DATA_LIMIT &&
      /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(profile.avatarDataUrl)));
}
function validResponse(value: ProfileResponse): boolean {
  return Number.isSafeInteger(value.revision) && value.revision >= 0 &&
    validProfile(value.profile);
}

export function useCloudProfile(session: AccountSessionController) {
  const state = ref<ProfileState>('signed-out');
  const profile = shallowRef<CloudProfile | null>(null);
  const revision = ref(0);
  const error = ref('');
  const notice = ref('');
  let generation = 0;
  let saving = false;
  let interval: number | undefined;

  function accountId(): string | null {
    const current = session.state.value;
    return current.status === 'authenticated' ? current.account.id : null;
  }

  async function load(): Promise<void> {
    const id = accountId();
    const current = ++generation;
    if (!id) {
      profile.value = null;
      revision.value = 0;
      error.value = '';
      notice.value = '';
      state.value = 'signed-out';
      return;
    }
    if (saving) return;
    if (!profile.value) state.value = 'loading';
    error.value = '';
    try {
      const result = await accountApiRequest<ProfileResponse>('/v1/account/profile');
      if (current !== generation || id !== accountId()) return;
      if (!validResponse(result)) throw new Error('The account profile is invalid.');
      profile.value = result.profile;
      revision.value = result.revision;
      state.value = 'ready';
    } catch (cause) {
      if (current !== generation || id !== accountId()) return;
      error.value = cause instanceof Error ? cause.message : 'Account profile could not be loaded.';
      state.value = 'error';
    }
  }
  async function save(draft: CloudProfile): Promise<void> {
    const id = accountId();
    if (!id || state.value !== 'ready' || saving || !validProfile(draft)) {
      throw new Error('Finish loading a valid account profile before saving.');
    }
    saving = true;
    state.value = 'saving';
    error.value = '';
    notice.value = '';
    const current = ++generation;
    try {
      const result = await accountApiRequest<ProfileResponse>('/v1/account/profile', {
        ...draft, revision: revision.value,
      });
      if (current !== generation || id !== accountId()) return;
      if (!validResponse(result)) throw new Error('The saved account profile is invalid.');
      profile.value = result.profile;
      revision.value = result.revision;
      notice.value = 'Profile saved and available on your other devices.';
      state.value = 'ready';
    } catch (cause) {
      if (current === generation && id === accountId()) {
        error.value = cause instanceof Error ? cause.message : 'Could not save your profile.';
        state.value = 'ready';
      }
      throw cause;
    } finally { saving = false; }
  }

  watch(accountId, () => { void load(); }, { immediate: true });
  // Refresh from cloud when visiting from another device. Never overwrite
  // editing drafts: caller only polls while not editing.
  onBeforeUnmount(() => {
    ++generation;
    if (interval !== undefined) clearInterval(interval);
  });
  function beginPolling(canRefresh: () => boolean): void {
    if (interval !== undefined) clearInterval(interval);
    interval = window.setInterval(() => {
      if (state.value === 'ready' && canRefresh()) void load();
    }, 60000);
  }
  return { state, profile, revision, error, notice, load, save, beginPolling };
}
export type CloudProfileController = ReturnType<typeof useCloudProfile>;
