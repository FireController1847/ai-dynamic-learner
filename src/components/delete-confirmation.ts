import { Icon } from './icon.ts';
import { useDialog } from './use-dialog.ts';

import { defineComponent, type PropType, h, useId } from 'vue';

export const DeleteConfirmation = defineComponent({
  name: 'DeleteConfirmation',
  props: {
    itemName: { type: String, required: true },
    itemLabel: { type: String as PropType<string | null>, default: null },
    title: { type: String, default: 'Are you sure?' },
    detail: { type: String as PropType<string | null>, default: null },
    confirmLabel: { type: String, required: true },
  },
  emits: { 'cancel': () => true, 'confirm': () => true },
  setup(props, { emit }) {
    const { dialog } = useDialog();
    const id = useId();
    const titleId = `${id}-title`;
    const descriptionId = `${id}-description`;

    return () => h('dialog', {
      ref: dialog,
      class: 'delete-confirmation',
      role: 'alertdialog',
      'aria-labelledby': titleId,
      'aria-describedby': descriptionId,
      onCancel: (event: Event) => {
        event.preventDefault();
        emit('cancel');
      },
    }, [h('div', { class: 'delete-confirmation-content' }, [
      h('div', { class: 'delete-confirmation-icon' }, [h(Icon, { name: 'trash' })]),
      h('p', { class: 'delete-confirmation-eyebrow' }, 'Dangerous action'),
      h('h2', { id: titleId }, props.title),
      h('div', { id: descriptionId }, [
        h('p', [
          'You are about to permanently delete ',
          props.itemLabel ? `the ${props.itemLabel} ` : '',
          h('strong', `“${props.itemName}”`),
          '.',
        ]),
        props.detail ? h('p', props.detail) : null,
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
        }, props.confirmLabel),
      ]),
    ])]);
  },
});
