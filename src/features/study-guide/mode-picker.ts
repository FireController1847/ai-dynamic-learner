import { defineComponent, h, type PropType } from 'vue';
import { GuideTypeIcon } from './guide-type-icon.ts';
import type { StudyGuideMode } from './library-model.ts';

const MODES: readonly { id: StudyGuideMode; label: string; description: string }[] = [
  { id: 'list', label: 'List mode', description: 'Titles with simple bullet points. Nothing else.' },
  { id: 'map', label: 'Map mode', description: 'Place topic stops on a snapped grid, then give each topic its own guide.' },
];

export const StudyGuideModePicker = defineComponent({
  name: 'StudyGuideModePicker',
  props: {
    destination: { type: String, required: true },
    disabledModes: { type: Array as PropType<StudyGuideMode[]>, default: () => [] },
    comingSoonModes: { type: Array as PropType<StudyGuideMode[]>, default: () => [] },
  },
  emits: { create: (_mode: StudyGuideMode) => true, cancel: () => true },
  setup(props, { emit }) {
    return () => h('section', { class: 'study-guide-builder', 'aria-labelledby': 'study-guide-builder-title' }, [
      h('header', { class: 'study-guide-builder-intro' }, [
        h('h2', { id: 'study-guide-builder-title' }, 'Choose a guide type'),
        h('p', 'Saved in ' + props.destination + '. Keep it simple, or lay the material out as a map.'),
      ]),
      h('div', { class: 'study-guide-mode-grid' }, MODES.map((mode) => {
        const disabled = props.disabledModes.includes(mode.id);
        const comingSoon = props.comingSoonModes.includes(mode.id);
        return h('button', {
          key: mode.id,
          type: 'button',
          class: ['study-guide-mode-card', { 'is-disabled': disabled }],
          disabled,
          onClick: () => emit('create', mode.id),
        }, [
          h(GuideTypeIcon, { mode: mode.id }),
          h('span', { class: 'study-guide-mode-copy' }, [
            h('strong', mode.label),
            comingSoon ? h('span', { class: 'study-guide-mode-status' }, 'Coming soon') : null,
            h('span', mode.description),
          ]),
        ]);
      })),
      h('div', { class: 'study-guide-builder-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
      ]),
    ]);
  },
});
