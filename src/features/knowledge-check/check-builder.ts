import { CHECK_TYPES, type CheckTypeId } from './check-types.ts';
import { Icon } from '../../components/icon.ts';

import { defineComponent, h } from 'vue';

export const CheckBuilder = defineComponent({
  name: 'KnowledgeCheckBuilder',
  props: {
    destination: { type: String, required: true },
  },
  emits: { 'create': (_type: CheckTypeId) => true, 'cancel': () => true },
  setup(props, { emit }) {
    return () => h('section', {
      class: 'knowledge-check-builder',
      'aria-labelledby': 'knowledge-check-builder-title',
    }, [
      h('header', { class: 'knowledge-check-builder-intro' }, [
        h('p', { class: 'knowledge-check-builder-eyebrow' }, 'New knowledge check'),
        h('h2', { id: 'knowledge-check-builder-title' }, 'Choose a mode'),
        h('p', `Saved in ${props.destination}. Choose how you want to check your knowledge.`),
      ]),
      h('div', { class: 'knowledge-check-type-grid' }, CHECK_TYPES.map((type) =>
        h('button', {
          key: type.id,
          type: 'button',
          class: 'knowledge-check-type-card',
          onClick: () => emit('create', type.id),
        }, [
          h(Icon, { name: type.icon, class: 'knowledge-check-type-icon' }),
          h('span', { class: 'knowledge-check-type-copy' }, [
            h('strong', type.label),
            h('span', type.description),
          ]),
        ]))),
      h('div', { class: 'knowledge-check-builder-actions' }, [
        h('button', {
          type: 'button',
          class: 'quiet-button',
          onClick: () => emit('cancel'),
        }, 'Cancel'),
      ]),
    ]);
  },
});
