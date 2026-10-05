import { defineComponent, h, onBeforeUnmount, type PropType } from 'vue';
import { useDialog } from './use-dialog.ts';

export const PopupDialog = defineComponent({
  name: 'PopupDialog',
  props: {
    title: { type: String, required: true },
    headingId: { type: String, required: true },
    width: { type: Number, default: 440 },
    returnFocus: { type: Object as PropType<HTMLElement | null>, default: null },
  },
  emits: { close: () => true },
  setup(props, { emit, slots }) {
    const focusTarget = props.returnFocus
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const { dialog } = useDialog();

    onBeforeUnmount(() => {
      if (focusTarget?.isConnected) focusTarget.focus();
    });

    return () => h('dialog', {
      ref: dialog,
      class: 'popup-dialog',
      'aria-labelledby': props.headingId,
      onCancel: (event: Event) => {
        event.preventDefault();
        emit('close');
      },
      onClick: (event: MouseEvent) => {
        if (event.target === dialog.value) emit('close');
      },
    }, [
      h('section', {
        class: 'popup-card',
        style: { '--popup-width': `${props.width}px` },
        onClick: (event: MouseEvent) => event.stopPropagation(),
      }, [
        h('header', { class: 'popup-header' }, [
          h('h2', { id: props.headingId }, props.title),
          h('button', {
            type: 'button',
            class: 'quiet-button popup-close',
            autofocus: true,
            onClick: () => emit('close'),
          }, 'Close'),
        ]),
        slots.default?.(),
      ]),
    ]);
  },
});
