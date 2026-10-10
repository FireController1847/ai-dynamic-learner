import { defineComponent, h, type PropType } from 'vue';
import { GuideTypeIcon } from './guide-type-icon.ts';
import type { GuideMode } from './library-model.ts';

const MODES: readonly { id: GuideMode; label: string; description: string }[] = [
  { id: 'list', label: 'List mode', description: 'Titles with simple bullet points. Nothing else.' },
  { id: 'map', label: 'Map mode', description: 'Place topic stops on a snapped grid, then give each topic its own guide.' },
];

export const GuideModePicker = defineComponent({
  name: 'GuideModePicker',
  props: {
    destination: { type: String, required: true },
    disabledModes: { type: Array as PropType<GuideMode[]>, default: () => [] },
    comingSoonModes: { type: Array as PropType<GuideMode[]>, default: () => [] },
  },
  emits: { create: (_mode: GuideMode) => true, cancel: () => true },
  setup(props, { emit }) {
    return () => h('section', { class: 'guide-builder', 'aria-labelledby': 'guide-builder-title' }, [
      h('header', { class: 'guide-builder-intro' }, [
        h('h2', { id: 'guide-builder-title' }, 'Choose a guide type'),
        h('p', 'Saved in ' + props.destination + '. Keep it simple, or lay the material out as a map.'),
      ]),
      h('div', { class: 'guide-mode-grid' }, MODES.map((mode) => {
        const disabled = props.disabledModes.includes(mode.id);
        const comingSoon = props.comingSoonModes.includes(mode.id);
        return h('button', {
          key: mode.id,
          type: 'button',
          class: ['guide-mode-card', { 'is-disabled': disabled }],
          disabled,
          onClick: () => emit('create', mode.id),
        }, [
          h(GuideTypeIcon, { mode: mode.id }),
          h('span', { class: 'guide-mode-copy' }, [
            h('strong', mode.label),
            comingSoon ? h('span', { class: 'guide-mode-status' }, 'Coming soon') : null,
            h('span', mode.description),
          ]),
        ]);
      })),
      h('div', { class: 'guide-builder-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
      ]),
    ]);
  },
});
