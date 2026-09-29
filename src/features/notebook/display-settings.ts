import { useDialog } from '../../components/use-dialog.ts';

import { defineComponent, h } from 'vue';

export const DisplaySettings = defineComponent({
  name: 'NotebookDisplaySettings',
  emits: { 'close': () => true },
  setup(props, { emit }) {
    const { dialog } = useDialog();

    return () => h('dialog', {
      ref: dialog,
      class: 'display-settings',
      'aria-labelledby': 'notebook-display-settings-title',
      onCancel: (event: Event) => {
        event.preventDefault();
        emit('close');
      },
    }, [
      h('header', { class: 'display-settings-header' }, [
        h('h2', { id: 'notebook-display-settings-title' }, 'Display options'),
        h('button', {
          type: 'button',
          class: 'quiet-button',
          autofocus: true,
          onClick: () => emit('close'),
        }, 'Done'),
      ]),
      h('p', { class: 'display-settings-description' },
        'Notebook display controls will be added alongside the rich Markdown editor.'),
      h('div', { class: 'notebook-settings-placeholder' }, [
        h('p', 'Editor appearance settings will live here.'),
      ]),
    ]);
  },
});
