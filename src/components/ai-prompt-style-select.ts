import { defineComponent, h, type PropType } from 'vue';
import { Icon } from './icon.ts';
import type { AiPromptVariant } from '../core/ai-prompt-variants.ts';

/** Both prompt styles are free to choose; suitability describes external AI chats. */
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
          'aria-label': 'Simple prompt — works best with free AI chats',
          onClick: () => emit('select', 'simple'),
        }, [
          h('span', { class: 'ai-prompt-style-choice-name' }, [h(Icon, { name: 'ai' }), 'Simple']),
          h('small', 'Works best with free AI chats'),
        ]),
        h('button', {
          type: 'button',
          class: ['ai-prompt-style-choice', { 'is-selected': props.value === 'detailed' }],
          'aria-pressed': props.value === 'detailed',
          'aria-label': 'Detailed prompt — works best with paid AI chats',
          onClick: () => emit('select', 'detailed'),
        }, [
          h('span', { class: 'ai-prompt-style-choice-name' }, [h(Icon, { name: 'document' }), 'Detailed']),
          h('small', 'Works best with paid AI chats'),
        ]),
      ]),
    ]);
  },
});
