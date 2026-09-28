import { Icon } from '../../components/icon.js';

const { h, onBeforeUnmount, onDeactivated, onMounted, ref } = window.Vue;

export const DeleteConfirmation = {
  name: 'NotebookDeleteConfirmation',
  props: { item: { type: Object, required: true } },
  emits: ['cancel', 'confirm'],
  setup(props, { emit }) {
    const dialog = ref(null);
    const close = () => { if (dialog.value?.open) dialog.value.close(); };

    onMounted(() => dialog.value.showModal());
    onBeforeUnmount(close);
    onDeactivated(close);

    return () => h('dialog', {
      ref: dialog,
      class: 'delete-confirmation',
      role: 'alertdialog',
      'aria-labelledby': 'notebook-delete-title',
      'aria-describedby': 'notebook-delete-description',
      onCancel: (event) => {
        event.preventDefault();
        emit('cancel');
      },
    }, [h('div', { class: 'delete-confirmation-content' }, [
      h('div', { class: 'delete-confirmation-icon' }, [h(Icon, { name: 'trash' })]),
      h('p', { class: 'delete-confirmation-eyebrow' }, 'Dangerous action'),
      h('h2', { id: 'notebook-delete-title' }, 'Delete this document?'),
      h('div', { id: 'notebook-delete-description' }, [
        h('p', ['You are about to permanently delete ', h('strong', `“${props.item.name}”`), '.']),
        h('p', 'This cannot be undone. You can cancel and download a backup first.'),
      ]),
      h('div', { class: 'delete-confirmation-actions' }, [
        h('button', {
          type: 'button',
          class: 'delete-cancel-button',
          autofocus: true,
          onClick: () => emit('cancel'),
        }, 'Cancel'),
        h('button', {
          type: 'button',
          class: 'delete-confirm-button',
          onClick: () => emit('confirm'),
        }, 'Delete document'),
      ]),
    ])]);
  },
};
