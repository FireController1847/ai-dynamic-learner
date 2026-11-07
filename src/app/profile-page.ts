import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import type { IdentityDirectory } from '../core/data/local-identities.ts';
import { LocalIdentityPanel } from './local-identity-panel.ts';
import { Icon } from '../components/icon.ts';
import { prepareProfilePhoto } from './profile-photo.ts';
import { PROFILE_ABOUT_LIMIT, PROFILE_EMAIL_LIMIT, PROFILE_NAME_LIMIT,
  PROFILE_PHONE_LIMIT, PROFILE_STORAGE_KEY, profileStorageKey, localProfileRepository } from './profile-storage.ts';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase() || 'DL';
}

export const ProfilePage = defineComponent({
  name: 'ProfilePage',
  props: {
    directory: { type: Object as PropType<IdentityDirectory | null>, default: null },
    onSwitch: { type: Function as PropType<(id: string) => Promise<void>>, required: true },
    onCreate: { type: Function as PropType<(label: string, transferGuest: boolean) => Promise<void>>, required: true },
  },
  setup(props) {
    const identityId = () => props.directory?.activeIdentityId ?? 'guest';
    const profile = ref(localProfileRepository.read(identityId()));
    const editing = ref(false);
    const draftName = ref(profile.value.displayName);
    const draftAbout = ref(profile.value.about);
    const draftEmail = ref(profile.value.email);
    const draftPhone = ref(profile.value.phone);
    const draftAvatar = ref(profile.value.avatarDataUrl);
    const photoInput = ref<HTMLInputElement | null>(null);
    const photoBusy = ref(false);
    const feedback = ref('');
    const error = ref('');
    const changedElsewhere = ref(false);
    let photoRequest = 0;

    function handleStorage(event: StorageEvent) {
      if (event.key !== profileStorageKey(identityId()) &&
        (identityId() !== 'guest' || event.key !== PROFILE_STORAGE_KEY) && event.key !== null) return;
      if (editing.value) {
        changedElsewhere.value = true;
        return;
      }
      profile.value = localProfileRepository.read(identityId());
      feedback.value = '';
    }

    watch(identityId, () => {
      photoRequest += 1;
      photoBusy.value = false;
      profile.value = localProfileRepository.read(identityId());
      editing.value = false;
      feedback.value = '';
      error.value = '';
      changedElsewhere.value = false;
    });
    onMounted(() => window.addEventListener('storage', handleStorage));
    onBeforeUnmount(() => {
      window.removeEventListener('storage', handleStorage);
      photoRequest += 1;
    });

    function beginEdit() {
      draftName.value = profile.value.displayName;
      draftAbout.value = profile.value.about;
      draftEmail.value = profile.value.email;
      draftPhone.value = profile.value.phone;
      draftAvatar.value = profile.value.avatarDataUrl;
      feedback.value = '';
      error.value = '';
      changedElsewhere.value = false;
      editing.value = true;
    }

    function cancelEdit() {
      photoRequest += 1;
      photoBusy.value = false;
      editing.value = false;
      error.value = '';
      if (changedElsewhere.value) profile.value = localProfileRepository.read(identityId());
      changedElsewhere.value = false;
    }

    async function choosePhoto(event: Event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;

      const request = ++photoRequest;
      photoBusy.value = true;
      error.value = '';
      try {
        const dataUrl = await prepareProfilePhoto(file);
        if (request === photoRequest && editing.value) draftAvatar.value = dataUrl;
      } catch (cause) {
        if (request === photoRequest && editing.value) {
          error.value = cause instanceof Error ? cause.message : 'The photo could not be processed.';
        }
      } finally {
        if (request === photoRequest) photoBusy.value = false;
      }
    }

    function removePhoto() {
      photoRequest += 1;
      photoBusy.value = false;
      draftAvatar.value = null;
      error.value = '';
    }

    function save(event: Event) {
      event.preventDefault();
      error.value = '';
      if (photoBusy.value) {
        error.value = 'Finish processing your photo before saving.';
        return;
      }
      if (changedElsewhere.value) {
        error.value = 'This profile changed in another tab. Cancel and reopen editing to see the latest version.';
        return;
      }
      const displayName = draftName.value.trim();
      const about = draftAbout.value.trim();
      const email = draftEmail.value.trim();
      const phone = draftPhone.value.trim();
      if (!displayName || displayName.length > PROFILE_NAME_LIMIT || about.length > PROFILE_ABOUT_LIMIT ||
        email.length > PROFILE_EMAIL_LIMIT || phone.length > PROFILE_PHONE_LIMIT) {
        error.value = 'Check the field lengths and enter a display name.';
        return;
      }
      const next = { displayName, about, email, phone, avatarDataUrl: draftAvatar.value };
      try {
        localProfileRepository.write(identityId(), next);
        profile.value = next;
        editing.value = false;
        feedback.value = 'Profile saved on this device.';
      } catch {
        error.value = 'This browser could not save your profile. Check that site storage is available.';
      }
    }

    return () => {
      const avatar = editing.value ? draftAvatar.value : profile.value.avatarDataUrl;
      const visibleName = editing.value ? draftName.value || profile.value.displayName : profile.value.displayName;

      return h('section', { class: 'profile-page', 'aria-label': 'Your profile' }, [
        h('div', { class: 'profile-intro' }, [
          h('h2', 'Your profile'),
          h('p', 'A place for your personal details while account support is being developed.'),
        ]),
        h('section', { class: 'profile-card', 'aria-label': 'Profile details' }, [
          h('div', { class: 'profile-card-heading' }, [
            h('div', { class: 'profile-avatar', 'aria-hidden': 'true' },
              avatar ? h('img', { class: 'profile-avatar-image', src: avatar, alt: '' }) : initials(visibleName)),
            h('div', { class: 'profile-identity' }, [
              h('h3', profile.value.displayName),
              h('p', 'Local profile'),
            ]),
            !editing.value ? h('button', {
              type: 'button', class: 'quiet-button profile-edit-button',
              onClick: beginEdit,
            }, [h(Icon, { name: 'pencil' }), 'Edit profile']) : null,
          ]),
          editing.value ? h('form', { class: 'profile-form', onSubmit: save }, [
            h('div', { class: 'profile-photo-field' }, [
              h('span', { class: 'profile-field-title' }, 'Profile picture'),
              h('div', { class: 'profile-photo-actions' }, [
                h('input', {
                  ref: photoInput, id: 'profile-photo-file', type: 'file',
                  class: 'visually-hidden', accept: 'image/jpeg,image/png,image/webp,image/gif',
                  tabindex: -1, 'aria-label': 'Choose a profile picture',
                  onChange: (event: Event) => { void choosePhoto(event); },
                }),
                h('button', {
                  type: 'button', class: 'quiet-button', disabled: photoBusy.value,
                  onClick: () => photoInput.value?.click(),
                }, [h(Icon, { name: 'upload' }), avatar ? 'Change photo' : 'Upload photo']),
                avatar ? h('button', {
                  type: 'button', class: 'quiet-button', onClick: removePhoto,
                }, 'Remove photo') : null,
              ]),
              h('p', { class: 'profile-field-hint', role: photoBusy.value ? 'status' : undefined },
                photoBusy.value ? 'Preparing photo…' : 'JPG, PNG, WebP, or GIF. Up to 8 MB; centered and resized locally.'),
            ]),
            h('div', { class: 'profile-field' }, [
              h('label', { for: 'profile-display-name' }, 'Display name'),
              h('input', {
                id: 'profile-display-name', type: 'text', required: true,
                maxlength: PROFILE_NAME_LIMIT, autocomplete: 'nickname',
                value: draftName.value,
                onInput: (event: Event) => {
                  if (event.target instanceof HTMLInputElement) draftName.value = event.target.value;
                },
              }),
            ]),
            h('div', { class: 'profile-contact-fields' }, [
              h('div', { class: 'profile-field' }, [
                h('label', { for: 'profile-email' }, 'Email (optional)'),
                h('input', {
                  id: 'profile-email', type: 'email', maxlength: PROFILE_EMAIL_LIMIT,
                  autocomplete: 'email', placeholder: 'you@example.com',
                  value: draftEmail.value,
                  onInput: (event: Event) => {
                    if (event.target instanceof HTMLInputElement) draftEmail.value = event.target.value;
                  },
                }),
              ]),
              h('div', { class: 'profile-field' }, [
                h('label', { for: 'profile-phone' }, 'Phone number (optional)'),
                h('input', {
                  id: 'profile-phone', type: 'tel', maxlength: PROFILE_PHONE_LIMIT,
                  autocomplete: 'tel', placeholder: '+1 (555) 123-4567',
                  value: draftPhone.value,
                  onInput: (event: Event) => {
                    if (event.target instanceof HTMLInputElement) draftPhone.value = event.target.value;
                  },
                }),
              ]),
            ]),
            h('div', { class: 'profile-field' }, [
              h('label', { for: 'profile-about' }, 'About'),
              h('textarea', {
                id: 'profile-about', rows: 5, maxlength: PROFILE_ABOUT_LIMIT,
                placeholder: 'A little about yourself, your interests, or what you enjoy learning…',
                value: draftAbout.value,
                onInput: (event: Event) => {
                  if (event.target instanceof HTMLTextAreaElement) draftAbout.value = event.target.value;
                },
              }),
              h('span', { class: 'profile-field-hint' }, `${draftAbout.value.length} / ${PROFILE_ABOUT_LIMIT}`),
            ]),
            error.value ? h('p', { class: 'profile-error', role: 'alert' }, error.value) : null,
            h('div', { class: 'profile-form-actions' }, [
              h('button', { type: 'submit', class: 'card-primary-button', disabled: photoBusy.value }, 'Save changes'),
              h('button', { type: 'button', class: 'quiet-button', onClick: cancelEdit }, 'Cancel'),
            ]),
          ]) : h('div', { class: 'profile-details' }, [
            h('div', { class: 'profile-detail' }, [
              h('span', { class: 'profile-detail-label' }, 'Display name'),
              h('p', profile.value.displayName),
            ]),
            h('div', { class: 'profile-contact-fields' }, [
              h('div', { class: 'profile-detail' }, [
                h('span', { class: 'profile-detail-label' }, 'Email'),
                h('p', profile.value.email || 'Not provided'),
              ]),
              h('div', { class: 'profile-detail' }, [
                h('span', { class: 'profile-detail-label' }, 'Phone number'),
                h('p', profile.value.phone || 'Not provided'),
              ]),
            ]),
            h('div', { class: 'profile-detail' }, [
              h('span', { class: 'profile-detail-label' }, 'About'),
              h('p', profile.value.about || 'Nothing here yet.'),
            ]),
          ]),
          feedback.value ? h('p', { class: 'profile-feedback', role: 'status' }, feedback.value) : null,
        ]),
        h(LocalIdentityPanel, {
          directory: props.directory,
          disabled: editing.value || photoBusy.value,
          onSwitch: props.onSwitch,
          onCreate: props.onCreate,
        }),
        h('p', { class: 'profile-storage-note' }, [
          h(Icon, { name: 'lock' }),
          'Your picture and contact details stay in this browser. This is not an online account, does not sync between devices, and is not included in workspace backups.',
        ]),
      ]);
    };
  },
});
