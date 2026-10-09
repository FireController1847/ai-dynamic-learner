import type { SetModeId } from './set-modes.ts';
import { SET_MODES } from './set-modes.ts';
import { SetModeIcon } from './set-mode-icon.ts';

import { defineComponent, h, ref } from 'vue';

export const SetBuilder = defineComponent({
  name: 'IndexCardsSetBuilder',
  props: {
    destination: { type: String, required: true },
  },
  emits: { 'create': (_mode: SetModeId) => true, 'cancel': () => true },
  setup(props, { emit }) {
    const heading = ref<HTMLElement | null>(null);
    return () => h('section', {
      class: 'index-cards-builder',
      'aria-labelledby': 'index-cards-builder-title',
    }, [
      h('header', { class: 'index-cards-builder-intro' }, [
        h('p', { class: 'index-cards-builder-eyebrow' }, 'New set'),
        h('h2', { id: 'index-cards-builder-title', ref: heading, tabindex: -1 }, 'Choose a study mode'),
        h('p', `Saved in ${props.destination}. Choose how you want to study this set.`),
      ]),
      h('div', { class: 'index-cards-mode-grid' }, SET_MODES.map((mode) =>
        h('button', {
          key: mode.id,
          type: 'button',
          class: 'index-cards-mode-card',
          'aria-disabled': !mode.available,
          'aria-describedby': !mode.available ? `index-cards-coming-${mode.id}` : undefined,
          onClick: () => { if (mode.available) emit('create', mode.id); },
        }, [
          h(SetModeIcon, { mode: mode.id }),
          h('span', { class: 'index-cards-mode-copy' }, [
            h('strong', mode.label),
            h('span', mode.description),
          ]),
          !mode.available ? h('span', {
            id: `index-cards-coming-${mode.id}`,
            class: 'index-cards-coming-tooltip',
            role: 'tooltip',
          }, 'Coming soon!') : null,
        ]))),
      h('div', { class: 'index-cards-builder-actions' }, [
        h('button', {
          type: 'button',
          class: 'quiet-button',
          onClick: () => emit('cancel'),
        }, 'Cancel'),
      ]),
    ]);
  },
});
