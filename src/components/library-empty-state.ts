import { defineComponent, h } from 'vue';
import { Icon } from './icon.ts';

export const LibraryEmptyState = defineComponent({
  name: 'LibraryEmptyState',
  props: {
    icon: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    actionLabel: { type: String, required: true },
    secondaryActionLabel: { type: String, default: '' },
  },
  emits: { create: () => true, secondary: () => true },
  setup(props, { emit }) {
    return () => h('div', { class: 'library-empty-state' }, [
      h(Icon, { name: props.icon }),
      h('h2', props.title),
      h('p', props.description),
      h('div', { class: 'library-empty-state-actions' }, [
        h('button', {
          type: 'button',
          class: 'card-primary-button',
          onClick: () => emit('create'),
        }, props.actionLabel),
        props.secondaryActionLabel ? h('button', {
          type: 'button',
          class: 'quiet-button library-empty-state-secondary',
          onClick: () => emit('secondary'),
        }, props.secondaryActionLabel) : null,
      ]),
    ]);
  },
});
