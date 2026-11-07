import { defineComponent, h, ref, type PropType } from 'vue';
import { DeleteConfirmation } from '../components/delete-confirmation.ts';
import { requestLeave } from '../core/leave-guards.ts';
import { MAX_IDENTITY_LABEL, selectedIdentity, type IdentityDirectory } from '../core/data/local-identities.ts';

type PendingRemoval = { id: string; label: string; workspaceId: string; step: 1 | 2 };

export const LocalIdentityPanel = defineComponent({
  name: 'LocalIdentityPanel',
  props: {
    directory: { type: Object as PropType<IdentityDirectory | null>, default: null },
    disabled: Boolean,
    onSwitch: { type: Function as PropType<(id: string) => Promise<void>>, required: true },
    onCreate: { type: Function as PropType<(label: string, transferGuest: boolean) => Promise<void>>, required: true },
    onRename: { type: Function as PropType<(id: string, label: string, oldLabel: string) => Promise<void>>, required: true },
    onDelete: { type: Function as PropType<(id: string, workspaceId: string) => Promise<void>>, required: true },
  },
  setup(props) {
    const label = ref('');
    const transferGuest = ref(false);
    const busy = ref(false);
    const message = ref('');
    const error = ref('');
    const renamingId = ref<string | null>(null);
    const previousName = ref('');
    const renameDraft = ref('');
    const removal = ref<PendingRemoval | null>(null);

    async function select(id: string) {
      if (busy.value || props.disabled || id === props.directory?.activeIdentityId || !requestLeave()) return;
      busy.value = true; error.value = ''; message.value = '';
      try { await props.onSwitch(id); message.value = 'Local workspace changed.'; }
      catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); }
      finally { busy.value = false; }
    }

    async function create(event: Event) {
      event.preventDefault();
      if (busy.value || props.disabled || !props.directory || !requestLeave()) return;
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

    function beginRename(id: string, name: string) {
      if (busy.value || props.disabled) return;
      renamingId.value = id;
      previousName.value = name;
      renameDraft.value = name;
      error.value = '';
      message.value = '';
    }

    async function rename(event: Event, id: string) {
      event.preventDefault();
      if (busy.value || props.disabled) return;
      const name = renameDraft.value.trim();
      if (!name || name.length > MAX_IDENTITY_LABEL) {
        error.value = 'Enter a name of up to 64 characters.';
        return;
      }
      busy.value = true; error.value = ''; message.value = '';
      try {
        await props.onRename(id, name, previousName.value);
        renamingId.value = null;
        message.value = 'Local identity renamed.';
      } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); }
      finally { busy.value = false; }
    }

    async function confirmRemove() {
      const target = removal.value;
      if (!target || busy.value || props.disabled || !requestLeave()) return;
      if (target.step === 1) { removal.value = { ...target, step: 2 }; return; }
      busy.value = true; error.value = ''; message.value = '';
      try {
        await props.onDelete(target.id, target.workspaceId);
        message.value = 'Local identity and its saved work were deleted.';
      } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); }
      finally { busy.value = false; removal.value = null; }
    }

    return () => h('section', { class: 'profile-identities', 'aria-label': 'Local workspace identities' }, [
      h('div', { class: 'profile-identities-intro' }, [
        h('h3', 'Local identities'),
        h('p', 'Separate device-local workspaces. These identities are not online accounts and do not provide password protection or cloud backup.'),
      ]),
      props.directory ? h('div', { class: 'profile-identity-list' },
        props.directory.identities.map(identity => h('div', { class: 'profile-identity-item', key: identity.id }, [
          renamingId.value === identity.id
            ? h('form', { class: 'profile-identity-rename', onSubmit: (event: Event) => { void rename(event, identity.id); } }, [
              h('label', { for: 'rename-identity-' + identity.id }, 'Workspace name'),
              h('input', { id: 'rename-identity-' + identity.id, type: 'text', required: true,
                maxlength: MAX_IDENTITY_LABEL, value: renameDraft.value,
                disabled: busy.value || props.disabled,
                onInput: (event: Event) => {
                  if (event.target instanceof HTMLInputElement) renameDraft.value = event.target.value;
                },
              }),
              h('button', { type: 'submit', class: 'quiet-button',
                disabled: busy.value || props.disabled || !renameDraft.value.trim(),
              }, 'Save'),
              h('button', { type: 'button', class: 'quiet-button', disabled: busy.value,
                onClick: () => { renamingId.value = null; },
              }, 'Cancel'),
            ]) : [
              h('div', { class: 'profile-identity-item-label' }, [
                h('strong', identity.label),
                h('span', identity.kind === 'guest' ? 'Guest' : 'Device-only'),
              ]),
              h('div', { class: 'profile-identity-item-actions' }, [
                identity.id === props.directory?.activeIdentityId
                  ? h('span', { class: 'profile-identity-active' }, 'Current')
                  : h('button', { type: 'button', class: 'quiet-button',
                    disabled: busy.value || props.disabled,
                    onClick: () => { void select(identity.id); },
                  }, 'Switch'),
                identity.kind === 'local' ? h('button', { type: 'button', class: 'quiet-button',
                  disabled: busy.value || props.disabled,
                  onClick: () => beginRename(identity.id, identity.label),
                }, 'Rename') : null,
                identity.kind === 'local' && identity.id !== props.directory?.activeIdentityId
                  ? h('button', { type: 'button', class: 'quiet-button delete-button',
                    disabled: busy.value || props.disabled,
                    onClick: () => { error.value = ''; removal.value = {
                      id: identity.id, workspaceId: identity.workspaceId, label: identity.label, step: 1,
                    }; },
                  }, 'Delete') : null,
              ]),
            ],
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
          h('span', 'Move my current Guest workspace and profile into the new identity (Guest becomes empty).'),
        ]) : null,
      ]) : null,
      error.value ? h('p', { role: 'alert', class: 'profile-error' }, error.value) : null,
      message.value ? h('p', { role: 'status', class: 'profile-feedback' }, message.value) : null,
      removal.value ? h(DeleteConfirmation, {
        key: removal.value.step,
        itemName: removal.value.label,
        title: removal.value.step === 1 ? 'Delete local identity?' : 'Permanently delete this workspace?',
        detail: removal.value.step === 1
          ? 'Deleting this identity also deletes its saved notebooks, cards, tasks, guides, Review sets, and historical recovery workspaces. Other identities are not affected. Download its backup first if you want to keep the data.'
          : 'This cannot be undone from this browser. Only a previously downloaded backup could restore the learning content. The identity and its local profile will also be removed.',
        confirmLabel: removal.value.step === 1 ? 'Continue' : 'Yes, delete identity and data',
        onCancel: () => { removal.value = null; },
        onConfirm: () => { void confirmRemove(); },
      }) : null,
    ]);
  },
});
