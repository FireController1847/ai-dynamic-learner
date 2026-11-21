import { defineComponent, h, type PropType } from 'vue';
import type { AiPromptVariant } from '../core/ai-prompt-variants.ts';

/** An app-owned configuration control displayed before the source/exchange steps. */
export const AiPromptStyleSelect = defineComponent({
  name: 'AiPromptStyleSelect',
  props: {
    value: { type: String as PropType<AiPromptVariant>, required: true },
    fieldClass: { type: String, default: '' },
  },
  emits: { select: (_value: AiPromptVariant) => true },
  setup(props, { emit }) {
    return () => h('label', { class: props.fieldClass }, [
      h('span', 'AI prompt'),
      h('select', { value: props.value, onChange: (event: Event) => {
        const value = (event.target as HTMLSelectElement).value;
        if (value === 'simple' || value === 'detailed') emit('select', value);
      } }, [
        h('option', { value: 'simple' }, 'Simple prompt'),
        h('option', { value: 'detailed' }, 'Detailed prompt'),
      ]),
      h('small', { class: 'study-ai-muted' }, props.value === 'simple'
        ? 'Works better with free versions of AI chats.'
        : 'Works better with paid versions of AI chats.'),
    ]);
  },
});
