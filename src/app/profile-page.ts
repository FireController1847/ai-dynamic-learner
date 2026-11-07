import { defineComponent, h, onBeforeUnmount, ref, watch, type PropType } from 'vue';
import { AccountAccessPanel } from './account-access-panel.ts';
import type { AccountSessionController } from './auth-session.ts';
import type { CloudSyncController } from './cloud-sync.ts';
import { Icon } from '../components/icon.ts';
import { prepareProfilePhoto } from './profile-photo.ts';
import {
  useCloudProfile, PROFILE_ABOUT_LIMIT, PROFILE_EMAIL_LIMIT, PROFILE_NAME_LIMIT, PROFILE_PHONE_LIMIT,
  type CloudProfile,
} from './cloud-profile.ts';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase() || 'DL';
}
function copyProfile(value: CloudProfile): CloudProfile {
  return { ...value };
}

export const ProfilePage = defineComponent({
  name: 'ProfilePage',
  props: {
    session: { type: Object as PropType<AccountSessionController>, required: true },
    cloudSync: { type: Object as PropType<CloudSyncController>, required: true },
  },
  setup(props) {
    const accountProfile = useCloudProfile(props.session);
    const editing = ref(false);
    const draft = ref<CloudProfile | null>(null);
    const photoInput = ref<HTMLInputElement | null>(null);
    const photoBusy = ref(false);
    const confirmedChoice = ref<'keep' | 'replace' | null>(null);
    const profileError = ref('');
    const downloaded = ref(false);
    let photoRequest = 0;

    watch(() => props.session.state.value.status === 'authenticated'
      ? props.session.state.value.account.id : null, () => {
      editing.value = false;
      draft.value = null;
      profileError.value = '';
      confirmedChoice.value = null;
      downloaded.value = false;
      photoRequest += 1;
    });

    watch(() => props.cloudSync.status.value, status => {
      if (status !== 'conflict') confirmedChoice.value = null;
    });
    onBeforeUnmount(() => { photoRequest += 1; });

    function beginEdit() {
      if (!accountProfile.profile.value) return;
      draft.value = copyProfile(accountProfile.profile.value);
      profileError.value = '';
      editing.value = true;
    }
    function cancelEdit() {
      photoRequest += 1;
      photoBusy.value = false;
      profileError.value = '';
      draft.value = null;
      editing.value = false;
    }
    async function choosePhoto(event: Event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      const file = input.files?.[0];
      input.value = '';
      if (!file || !editing.value) return;
      const request = ++photoRequest;
      photoBusy.value = true;
      profileError.value = '';
      try {
        const dataUrl = await prepareProfilePhoto(file);
        if (request === photoRequest && draft.value) draft.value.avatarDataUrl = dataUrl;
      } catch (cause) {
        if (request === photoRequest) {
          profileError.value = cause instanceof Error ? cause.message : 'The photo could not be processed.';
        }
      } finally {
        if (request === photoRequest) photoBusy.value = false;
      }
    }
    async function save(event: Event) {
      event.preventDefault();
      if (!draft.value || photoBusy.value) return;
      profileError.value = '';
      const next = {
        ...draft.value,
        displayName: draft.value.displayName.trim(),
        about: draft.value.about.trim(),
        contactEmail: draft.value.contactEmail.trim(),
        phone: draft.value.phone.trim(),
      };
      if (!next.displayName || next.displayName.length > PROFILE_NAME_LIMIT ||
          next.about.length > PROFILE_ABOUT_LIMIT ||
          next.contactEmail.length > PROFILE_EMAIL_LIMIT ||
          next.phone.length > PROFILE_PHONE_LIMIT) {
        profileError.value = 'Check the profile fields before saving.';
        return;
      }
      try {
        await accountProfile.save(next);
        editing.value = false;
        draft.value = null;
      } catch (cause) {
        profileError.value = cause instanceof Error ? cause.message : 'Could not save profile.';
      }
    }
    function profileField(label: string, value: string) {
      return h('div', { class: 'profile-detail' }, [
        h('span', { class: 'profile-detail-label' }, label),
        h('p', value || 'Not provided'),
      ]);
    }
    function signOut() {
      confirmedChoice.value = null;
      void props.session.signOut().catch(() => undefined);
    }
    async function downloadLocal() {
      downloaded.value = false;
      try {
        await props.cloudSync.downloadLocal();
        downloaded.value = true;
      } catch {
        // The cloud-sync controller presents the actionable error.
      }
    }
    function chooseWorkspace(choice: 'keep' | 'replace') {
      confirmedChoice.value = confirmedChoice.value === choice ? null : choice;
    }
    async function confirmWorkspaceChoice() {
      const choice = confirmedChoice.value;
      if (!choice) return;
      confirmedChoice.value = null;
      if (choice === 'keep') await props.cloudSync.keepLocalWorkspace();
      else await props.cloudSync.useCloudWorkspace();
    }

    function handoffScreen() {
      const sync = props.cloudSync;
      const busy = sync.status.value === 'syncing' || props.session.busy.value;
      const choice = confirmedChoice.value;
      return h('section', { class: 'account-handoff', 'aria-label': 'Choose your workspace' }, [
        h('div', { class: 'account-handoff-emblem' }, h(Icon, { name: 'archive' })),
        h('h2', 'Choose your workspace'),
        h('p', 'This device and your account have different workspaces. Choose which copy to keep. The copies will not be merged.'),
        h('div', { class: 'account-handoff-options' }, [
          h('div', { class: 'account-handoff-choice' }, [
            h('button', { type: 'button', class: 'card-primary-button', disabled: busy,
              onClick: () => chooseWorkspace('keep'),
            }, 'Keep my workspace'),
            h('p', 'Upload this device’s data to replace the cloud copy.'),
          ]),
          h('div', { class: 'account-handoff-choice' }, [
            h('button', { type: 'button', class: 'quiet-button', disabled: busy,
              onClick: () => chooseWorkspace('replace'),
            }, 'Replace my workspace'),
            h('p', 'Download the cloud copy to replace this device’s data.'),
          ]),
        ]),
        choice ? h('div', { class: 'account-handoff-confirm', role: 'group',
          'aria-label': choice === 'keep' ? 'Confirm cloud workspace replacement' : 'Confirm local workspace replacement',
        }, [
          h('strong', choice === 'keep' ? 'Replace the cloud workspace?' : 'Replace this device’s workspace?'),
          h('p', choice === 'keep'
            ? 'Your local workspace will become the account’s synced copy. Cloud changes not present on this device will no longer be current. Your local data will stay here.'
            : 'This replaces the selected local workspace and its saved generations with the cloud copy. Any local changes not in the cloud will be lost. You can download a local backup below.'),
          h('div', { class: 'profile-form-actions' }, [
            h('button', { type: 'button', class: 'quiet-button', disabled: busy,
              onClick: () => { confirmedChoice.value = null; },
            }, 'Cancel'),
            h('button', { type: 'button', class: 'card-primary-button', disabled: busy,
              onClick: () => { void confirmWorkspaceChoice(); },
            }, choice === 'keep' ? 'Yes, replace cloud copy' : 'Yes, replace local data'),
          ]),
        ]) : null,
        h('div', { class: 'account-handoff-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', disabled: busy,
            onClick: () => { void downloadLocal(); },
          }, [h(Icon, { name: 'download' }), 'Download local workspace']),
          h('button', { type: 'button', class: 'quiet-button', disabled: busy,
            onClick: signOut,
          }, 'Sign out and keep local data'),
        ]),
        downloaded.value ? h('p', { class: 'profile-field-hint account-handoff-hint', role: 'status' },
          'Backup download started. Confirm the file was saved before replacing local data.') : null,
        h('p', { class: 'account-handoff-note', role: 'status' }, sync.message.value),
      ]);
    }

    function profileCard() {
      const profile = accountProfile.profile.value;
      if (accountProfile.state.value === 'loading' || !profile) {
        return h('section', { class: 'profile-card', role: 'status' }, [
          h('p', accountProfile.state.value === 'error' ? accountProfile.error.value : 'Loading account profile…'),
          accountProfile.state.value === 'error' ? h('button', {
            type: 'button', class: 'quiet-button', onClick: () => { void accountProfile.load(); },
          }, 'Try again') : null,
        ]);
      }
      const values = editing.value && draft.value ? draft.value : profile;
      const avatar = values.avatarDataUrl;
      return h('section', { class: 'profile-card', 'aria-label': 'Account profile' }, [
        h('div', { class: 'profile-card-heading' }, [
          h('div', { class: 'profile-avatar', 'aria-hidden': 'true' },
            avatar ? h('img', { class: 'profile-avatar-image', src: avatar, alt: '' }) : initials(values.displayName)),
          h('div', { class: 'profile-identity' }, [
            h('h3', profile.displayName),
            h('p', 'Synced account profile'),
          ]),
          !editing.value ? h('button', { type: 'button', class: 'quiet-button profile-edit-button',
            onClick: beginEdit,
          }, [h(Icon, { name: 'pencil' }), 'Edit profile']) : null,
        ]),
        editing.value && draft.value
          ? h('form', { class: 'profile-form', onSubmit: (event: Event) => { void save(event); } }, [
            h('div', { class: 'profile-photo-field' }, [
              h('span', { class: 'profile-field-title' }, 'Profile picture'),
              h('div', { class: 'profile-photo-actions' }, [
                h('input', { ref: photoInput, id: 'profile-photo-file', type: 'file',
                  class: 'visually-hidden', accept: 'image/jpeg,image/png,image/webp,image/gif',
                  tabindex: -1, 'aria-label': 'Choose a profile picture',
                  onChange: (event: Event) => { void choosePhoto(event); } }),
                h('button', { type: 'button', class: 'quiet-button', disabled: photoBusy.value,
                  onClick: () => photoInput.value?.click(),
                }, [h(Icon, { name: 'upload' }), avatar ? 'Change photo' : 'Upload photo']),
                avatar ? h('button', { type: 'button', class: 'quiet-button', onClick: () => {
                  photoRequest += 1; photoBusy.value = false;
                  if (draft.value) draft.value.avatarDataUrl = null;
                } }, 'Remove photo') : null,
              ]),
              h('p', { class: 'profile-field-hint' }, 'Images are resized to 256px before sync.'),
            ]),
            ...([
              ['displayName', 'Display name', PROFILE_NAME_LIMIT, 'text'],
              ['contactEmail', 'Contact email (optional)', PROFILE_EMAIL_LIMIT, 'email'],
              ['phone', 'Phone (optional)', PROFILE_PHONE_LIMIT, 'tel'],
            ] as const).map(([key, label, limit, type]) => h('div', { class: 'profile-field' }, [
              h('label', { for: 'account-profile-' + key }, label),
              h('input', { id: 'account-profile-' + key, type, maxlength: limit,
                required: key === 'displayName', value: draft.value?.[key] ?? '',
                onInput: (event: Event) => {
                  if (event.target instanceof HTMLInputElement && draft.value) {
                    draft.value[key] = event.target.value;
                  }
                },
              }),
            ])),
            h('div', { class: 'profile-field' }, [
              h('label', { for: 'account-profile-about' }, 'About'),
              h('textarea', { id: 'account-profile-about', rows: 4, maxlength: PROFILE_ABOUT_LIMIT,
                value: draft.value.about, onInput: (event: Event) => {
                  if (event.target instanceof HTMLTextAreaElement && draft.value) {
                    draft.value.about = event.target.value;
                  }
                } }),
            ]),
            profileError.value ? h('p', { class: 'profile-error', role: 'alert' }, profileError.value) : null,
            h('div', { class: 'profile-form-actions' }, [
              h('button', { type: 'submit', class: 'card-primary-button',
                disabled: photoBusy.value || accountProfile.state.value === 'saving',
              }, accountProfile.state.value === 'saving' ? 'Saving…' : 'Save profile'),
              h('button', { type: 'button', class: 'quiet-button', onClick: cancelEdit }, 'Cancel'),
            ]),
          ]) : h('div', { class: 'profile-details' }, [
            profileField('Account email', props.session.state.value.status === 'authenticated'
              ? props.session.state.value.account.email ?? '' : ''),
            profileField('Contact email', profile.contactEmail),
            profileField('Phone', profile.phone),
            profileField('About', profile.about),
          ]),
        accountProfile.notice.value ? h('p', { class: 'profile-feedback', role: 'status' },
          accountProfile.notice.value) : null,
      ]);
    }

    return () => {
      const authenticated = props.session.state.value.status === 'authenticated';
      const sync = props.cloudSync;
      if (!authenticated) {
        return h('section', { class: 'profile-page profile-page--sign-in', 'aria-label': 'Account access' }, [
          h(AccountAccessPanel, { session: props.session }),
        ]);
      }
      return h('section', { class: 'profile-page', 'aria-label': 'Your account' }, [
        sync.status.value === 'conflict' ? handoffScreen() : [
          h('div', { class: 'profile-intro profile-intro--account' }, [
            h('h2', 'Your account'),
            h('button', { type: 'button', class: 'quiet-button',
              disabled: props.session.busy.value, onClick: signOut,
            }, 'Sign out'),
          ]),
          profileCard(),
          h('section', { class: 'profile-identities profile-cloud-sync', 'aria-label': 'Cloud synchronization' }, [
            h('div', { class: 'profile-cloud-sync-heading' }, [
              h('span', { class: 'profile-cloud-sync-icon' }, h(Icon, {
                name: sync.status.value === 'synced' ? 'check' : 'refresh-cw',
                class: sync.status.value === 'loading' || sync.status.value === 'checking' ||
                  sync.status.value === 'syncing' ? 'profile-cloud-sync-spinner' : '',
              })),
              h('h3', 'Cloud sync'),
              h('button', { type: 'button', class: 'quiet-button profile-cloud-sync-action',
                disabled: ['loading', 'checking', 'syncing', 'conflict', 'off'].includes(sync.status.value) ||
                  sync.cooldownSeconds.value > 0,
                title: sync.cooldownSeconds.value > 0
                  ? 'Synchronization available in ' + sync.cooldownSeconds.value + ' seconds'
                  : 'Check the latest cloud copy and synchronize manually',
                onClick: () => { void sync.sync(); },
              }, sync.cooldownSeconds.value > 0 ? 'Sync (' + sync.cooldownSeconds.value + 's)' : 'Sync'),
            ]),
            h('p', { role: 'status' }, sync.message.value),
          ]),
          props.session.notice.value ? h('p', { class: 'profile-feedback', role: 'status' },
            props.session.notice.value) : null,
          props.session.error.value ? h('p', { class: 'profile-error', role: 'alert' },
            props.session.error.value) : null,
        ],
      ]);
    };
  },
});
