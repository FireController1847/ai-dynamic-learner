import { defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';
import { Icon } from '../components/icon.ts';
import { PROFILE_ABOUT_LIMIT, PROFILE_NAME_LIMIT, PROFILE_STORAGE_KEY,
  readLocalProfile, writeLocalProfile } from './profile-storage.ts';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase() || 'DL';
}

export const ProfilePage = defineComponent({
  name: 'ProfilePage',
  setup() {
    const profile = ref(readLocalProfile());
    const editing = ref(false);
    const draftName = ref(profile.value.displayName);
    const draftAbout = ref(profile.value.about);
    const feedback = ref('');
    const error = ref('');
    const changedElsewhere = ref(false);

    function handleStorage(event: StorageEvent) {
      if (event.key !== PROFILE_STORAGE_KEY && event.key !== null) return;
      if (editing.value) {
        changedElsewhere.value = true;
        return;
      }
      profile.value = readLocalProfile();
      feedback.value = '';
    }

    onMounted(() => window.addEventListener('storage', handleStorage));
    onBeforeUnmount(() => window.removeEventListener('storage', handleStorage));

    function beginEdit() {
      draftName.value = profile.value.displayName;
      draftAbout.value = profile.value.about;
      feedback.value = '';
      error.value = '';
      changedElsewhere.value = false;
      editing.value = true;
    }

    function cancelEdit() {
      editing.value = false;
      error.value = '';
      if (changedElsewhere.value) profile.value = readLocalProfile();
      changedElsewhere.value = false;
    }

    function save(event: Event) {
      event.preventDefault();
      error.value = '';
      if (changedElsewhere.value) {
        error.value = 'This profile changed in another tab. Cancel and reopen editing to see the latest version.';
        return;
      }
      const displayName = draftName.value.trim();
      const about = draftAbout.value.trim();
      if (!displayName || displayName.length > PROFILE_NAME_LIMIT || about.length > PROFILE_ABOUT_LIMIT) {
        error.value = 'Enter a display name (up to 64 characters) and an About section of at most 500 characters.';
        return;
      }
      const next = { displayName, about };
      try {
        writeLocalProfile(next);
        profile.value = next;
        editing.value = false;
        feedback.value = 'Profile saved on this device.';
      } catch {
        error.value = 'This browser could not save your profile. Check that site storage is available.';
      }
    }

    return () => h('section', { class: 'profile-page', 'aria-label': 'Your profile' }, [
      h('div', { class: 'profile-intro' }, [
        h('h2', 'Your profile'),
        h('p', 'A place for your personal details while account support is being developed.'),
      ]),
      h('section', { class: 'profile-card', 'aria-label': 'Profile details' }, [
        h('div', { class: 'profile-card-heading' }, [
          h('div', { class: 'profile-avatar', 'aria-hidden': 'true' }, initials(profile.value.displayName)),
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
            h('button', { type: 'submit', class: 'card-primary-button' }, 'Save changes'),
            h('button', { type: 'button', class: 'quiet-button', onClick: cancelEdit }, 'Cancel'),
          ]),
        ]) : h('div', { class: 'profile-details' }, [
          h('div', { class: 'profile-detail' }, [
            h('span', { class: 'profile-detail-label' }, 'Display name'),
            h('p', profile.value.displayName),
          ]),
          h('div', { class: 'profile-detail' }, [
            h('span', { class: 'profile-detail-label' }, 'About'),
            h('p', profile.value.about || 'Nothing here yet.'),
          ]),
        ]),
        feedback.value ? h('p', { class: 'profile-feedback', role: 'status' }, feedback.value) : null,
      ]),
      h('p', { class: 'profile-storage-note' }, [
        h(Icon, { name: 'lock' }),
        'Only this browser stores your profile. It is not an online account, does not sync between devices, and is not included in workspace backups.',
      ]),
    ]);
  },
});
