import { defineComponent, h, ref, type PropType } from 'vue';
import { MAX_IDENTITY_LABEL, selectedIdentity, type IdentityDirectory } from '../core/data/local-identities.ts';

export const LocalIdentityPanel = defineComponent({
  name: 'LocalIdentityPanel',
  props: {
    directory: { type: Object as PropType<IdentityDirectory | null>, default: null },
    disabled: Boolean,
    onSwitch: { type: Function as PropType<(id: string) => Promise<void>>, required: true },
    onCreate: { type: Function as PropType<(label: string, transferGuest: boolean) => Promise<void>>, required: true },
  },
  setup(props) {
    const label = ref('');
    const transferGuest = ref(false);
    const busy = ref(false);
    const message = ref('');
    const error = ref('');

    async function select(id: string) {
      if (busy.value || props.disabled || id === props.directory?.activeIdentityId) return;
      busy.value = true; error.value = ''; message.value = '';
      try { await props.onSwitch(id); message.value = 'Local workspace changed.'; }
      catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); }
      finally { busy.value = false; }
    }

    async function create(event: Event) {
      event.preventDefault();
      if (busy.value || props.disabled || !props.directory) return;
      const name = label.value.trim();
      if (!name || name.length > MAX_IDENTITY_LABEL) {
        error.value = 'Enter an identity name of up to 64 characters.';
        return;
      }
      busy.value = true; error.value = ''; message.value = '';
      try {
        await props.onCreate(name, transferGuest.value && props.directory.activeIdentityId === 'guest');
        label.value = ''; transferGuest.value = false;
        message.value = 'Local identity created. This is not an online account.';
      } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); }
      finally { busy.value = false; }
    }

    return () => h('section', { class: 'profile-identities', 'aria-label': 'Local workspace identities' }, [
      h('div', { class: 'profile-identities-intro' }, [
        h('h3', 'Local identities'),
        h('p', 'Keep separate workspaces in this browser. These identities do not log in, sync, or protect data from other users of this device.'),
      ]),
      props.directory ? h('div', { class: 'profile-identity-list' },
        props.directory.identities.map(identity => h('div', { class: 'profile-identity-item', key: identity.id }, [
          h('div', { class: 'profile-identity-item-label' }, [
            h('strong', identity.label),
            h('span', identity.kind === 'guest' ? 'Guest' : 'Device-only'),
          ]),
          identity.id === props.directory?.activeIdentityId
            ? h('span', { class: 'profile-identity-active' }, 'Current')
            : h('button', { type: 'button', class: 'quiet-button',
              disabled: busy.value || props.disabled,
              onClick: () => { void select(identity.id); },
            }, 'Switch'),
        ]))) : h('p', { class: 'profile-field-hint' }, 'Opening local identities…'),
      props.directory ? h('form', { class: 'profile-identity-create', onSubmit: (event: Event) => { void create(event); } }, [
        h('label', { for: 'profile-identity-name' }, 'New local identity'),
        h('div', { class: 'profile-identity-create-row' }, [
          h('input', {
            id: 'profile-identity-name', type: 'text', maxlength: MAX_IDENTITY_LABEL,
            value: label.value, placeholder: 'e.g. Personal or School',
            disabled: busy.value || props.disabled,
            onInput: (event: Event) => {
              if (event.target instanceof HTMLInputElement) label.value = event.target.value;
            },
          }),
          h('button', { type: 'submit', class: 'quiet-button',
            disabled: busy.value || props.disabled || !label.value.trim(),
          }, busy.value ? 'Working…' : 'Create local identity'),
        ]),
        selectedIdentity(props.directory).kind === 'guest' ? h('label', { class: 'profile-transfer-option' }, [
          h('input', {
            type: 'checkbox', checked: transferGuest.value, disabled: busy.value || props.disabled,
            onChange: (event: Event) => {
              if (event.target instanceof HTMLInputElement) transferGuest.value = event.target.checked;
            },
          }),
          h('span', 'Move my current guest workspace and profile into the new identity (guest becomes empty).'),
        ]) : null,
      ]) : null,
      error.value ? h('p', { role: 'alert', class: 'profile-error' }, error.value) : null,
      message.value ? h('p', { role: 'status', class: 'profile-feedback' }, message.value) : null,
    ]);
  },
});
