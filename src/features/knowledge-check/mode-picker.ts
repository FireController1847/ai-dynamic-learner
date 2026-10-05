import { CHECK_MODES, type CheckModeId } from './check-types.ts';
import { Icon } from '../../components/icon.ts';
import { defineComponent, h } from 'vue';

export const ModePicker = defineComponent({
  name: 'KnowledgeModePicker',
  props: { setName: { type: String, required: true } },
  emits: { choose: (_mode: CheckModeId) => true, build: () => true },
  setup(props, { emit }) {
    return () => h('section', { class: 'knowledge-check-builder', 'aria-label': 'Choose how to use this knowledge set' }, [
      h('header', { class: 'knowledge-check-builder-intro' }, [h('p', { class: 'knowledge-check-builder-eyebrow' }, 'One knowledge set'),
        h('h2', props.setName), h('p', 'Choose how you want to use these questions. You can switch modes at any time.')]),
      h('div', { class: 'knowledge-check-type-grid' }, CHECK_MODES.map((mode) => h('button', {
        key: mode.id, type: 'button', class: 'knowledge-check-type-card', onClick: () => emit('choose', mode.id),
      }, [h(Icon, { name: mode.icon, class: 'knowledge-check-type-icon' }), h('span', { class: 'knowledge-check-type-copy' },
        [h('strong', mode.label), h('span', mode.description)])]))),
      h('div', { class: 'knowledge-check-builder-actions' }, [h('button', { type: 'button', class: 'quiet-button',
        onClick: () => emit('build') }, 'Build questions')]),
    ]);
  },
});
