import type { LibraryItem, MovePosition } from './tree-model.ts';
import { Icon } from '../../components/icon.ts';
import { countItems } from './tree-model.ts';

import { defineComponent, type PropType, h, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';

export const DeleteConfirmation = defineComponent({
  name: 'DeleteConfirmation',
  props: { item: { type: Object as PropType<LibraryItem>, required: true } },
  emits: { 'cancel': () => true, 'confirm': () => true },
  setup(props, { emit }) {
    const dialog = ref<HTMLDialogElement | null>(null);

    function close() {
      if (dialog.value?.open) dialog.value.close();
    }

    onMounted(() => dialog.value?.showModal());
    onBeforeUnmount(close);
    onDeactivated(close);

    return () => h('dialog', {
      ref: dialog,
      class: 'delete-confirmation',
      role: 'alertdialog',
      'aria-labelledby': 'delete-confirmation-title',
      'aria-describedby': 'delete-confirmation-description',
      onCancel: (event: Event) => {
        event.preventDefault();
        emit('cancel');
      },
    }, [h('div', { class: 'delete-confirmation-content' }, [
      h('div', { class: 'delete-confirmation-icon' }, [h(Icon, { name: 'trash' })]),
      h('p', { class: 'delete-confirmation-eyebrow' }, 'Dangerous action'),
      h('h2', { id: 'delete-confirmation-title' }, 'Are you sure?'),
      h('div', { id: 'delete-confirmation-description' }, [
        h('p', ['You are about to permanently delete the ', props.item.kind, ' ',
          h('strong', `“${props.item.name}”`), '.']),
        props.item.kind === 'group'
          ? h('p', `This also deletes every group, set, and card inside it (${countItems(props.item.children)} nested groups and sets).`)
          : h('p', 'This also deletes every card in this set.'),
        h('p', 'This cannot be undone. You can cancel and download a backup first.'),
      ]),
      h('div', { class: 'delete-confirmation-actions' }, [
        h('button', {
          type: 'button', class: 'delete-cancel-button', autofocus: true,
          onClick: () => emit('cancel'),
        }, 'Cancel'),
        h('button', {
          type: 'button', class: 'delete-confirm-button', onClick: () => emit('confirm'),
        }, `Delete ${props.item.kind}`),
      ]),
    ])]);
  },
});
