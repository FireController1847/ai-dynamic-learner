import type { LibraryItem, MovePosition } from './library-model.ts';
import { Icon } from '../../components/icon.ts';
import { countItems, countWordSearches } from './library-model.ts';

import { defineComponent, type PropType, h, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';

export const DeleteConfirmation = defineComponent({
  name: 'WordSearchDeleteConfirmation',
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
      class: 'word-search-delete-confirmation',
      role: 'alertdialog',
      'aria-labelledby': 'word-search-delete-title',
      'aria-describedby': 'word-search-delete-description',
      onCancel: (event: Event) => {
        event.preventDefault();
        emit('cancel');
      },
    }, [h('div', { class: 'word-search-delete-content' }, [
      h('div', { class: 'word-search-delete-icon' }, [h(Icon, { name: 'trash' })]),
      h('p', { class: 'word-search-delete-eyebrow' }, 'Dangerous action'),
      h('h2', { id: 'word-search-delete-title' }, 'Are you sure?'),
      h('div', { id: 'word-search-delete-description' }, [
        h('p', ['You are about to permanently delete the ',
          props.item.kind === 'word-search' ? 'word search' : 'group', ' ',
          h('strong', `“${props.item.name}”`), '.']),
        props.item.kind === 'group'
          ? h('p', `This also deletes ${countItems(props.item.children)} nested library items, including ${countWordSearches(props.item.children)} word searches.`)
          : h('p', 'The saved word search will be removed from the library.'),
        h('p', 'This cannot be undone. You can cancel and download a backup first.'),
      ]),
      h('div', { class: 'word-search-delete-actions' }, [
        h('button', {
          type: 'button', class: 'delete-cancel-button', autofocus: true,
          onClick: () => emit('cancel'),
        }, 'Cancel'),
        h('button', {
          type: 'button', class: 'delete-confirm-button', onClick: () => emit('confirm'),
        }, props.item.kind === 'group' ? 'Delete group' : 'Delete word search'),
      ]),
    ])]);
  },
});
