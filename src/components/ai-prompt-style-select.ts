import { defineComponent, h, type PropType } from 'vue';
import { Icon } from './icon.ts';
import type { AiPromptVariant } from '../core/ai-prompt-variants.ts';

/** Compact, accessible selection before the guided AI exchange. */
export const AiPromptStyleSelect = defineComponent({
  name: 'AiPromptStyleSelect',
  props: {
    value: { type: String as PropType<AiPromptVariant>, required: true },
    fieldClass: { type: String, default: '' },
  },
  emits: { select: (_value: AiPromptVariant) => true },
  setup(props, { emit }) {
    return () => h('fieldset', { class: ['ai-prompt-style-select', props.fieldClass] }, [
      h('legend', 'AI prompt'),
      h('div', { class: 'ai-prompt-style-options', role: 'group', 'aria-label': 'AI prompt style' }, [
        h('button', {
          type: 'button',
          class: ['ai-prompt-style-choice', { 'is-selected': props.value === 'simple' }],
          'aria-pressed': props.value === 'simple',
          'aria-label': 'Simple prompt, suited to free AI chats',
          title: 'Simple — works well with free AI chats',
          onClick: () => emit('select', 'simple'),
        }, [h(Icon, { name: 'ai' }), h('span', 'Simple')]),
        h('button', {
          type: 'button',
          class: ['ai-prompt-style-choice', 'is-detailed', { 'is-selected': props.value === 'detailed' }],
          'aria-pressed': props.value === 'detailed',
          'aria-label': 'Detailed prompt, suited to paid AI chats',
          title: 'Detailed — works best with paid AI chats',
          onClick: () => emit('select', 'detailed'),
        }, [h(Icon, { name: 'crown' }), h('span', 'Detailed')]),
      ]),
    ]);
  },
});
