import { defineComponent, h, type PropType } from 'vue';
import { Icon } from './icon.ts';

/** Shared AI priority cards used by Review and Guide. */
export interface AiFocusOption {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export const AiFocusChoices = defineComponent({
  name: 'AiFocusChoices',
  props: {
    options: { type: Array as PropType<readonly AiFocusOption[]>, required: true },
    value: { type: String, required: true },
    name: { type: String, required: true },
    legend: { type: String, default: 'AI focus' },
  },
  emits: { select: (_id: string) => true },
  setup(props, { emit }) {
    return () => h('fieldset', { class: 'review-ai-focus ai-focus-choices' }, [
      h('legend', props.legend),
      h('div', { class: 'review-ai-focus-options' }, props.options.map(option => h('label', {
        class: 'review-ai-focus-option', key: option.id,
      }, [
        h('input', {
          type: 'radio', name: props.name, value: option.id,
          checked: props.value === option.id,
          onChange: () => emit('select', option.id),
        }),
        h(Icon, { name: option.icon }),
        h('span', { class: 'review-ai-focus-copy' }, [
          h('strong', option.label),
          h('span', option.description),
        ]),
      ]))),
    ]);
  },
});
