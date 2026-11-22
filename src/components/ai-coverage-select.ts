import { defineComponent, h, type PropType } from 'vue';
import { AI_COVERAGE_CHOICES, type AiCoverageLevel } from '../core/ai-coverage.ts';

/** Same coverage choices and descriptions across all AI prompt workflows. */
export const AiCoverageSelect = defineComponent({
  name: 'AiCoverageSelect',
  props: {
    value: { type: String as PropType<AiCoverageLevel>, required: true },
    fieldClass: { type: String, default: '' },
  },
  emits: { select: (_value: AiCoverageLevel) => true },
  setup(props, { emit }) {
    return () => h('label', { class: props.fieldClass }, [
      h('span', 'Coverage'),
      h('select', {
        value: props.value,
        onChange: (event: Event) => {
          const value = (event.target as HTMLSelectElement).value;
          const choice = AI_COVERAGE_CHOICES.find(option => option.value === value);
          if (choice) emit('select', choice.value);
        },
      }, AI_COVERAGE_CHOICES.map(option => h('option', { value: option.value }, option.label))),
      h('small', { class: 'study-ai-muted' },
        AI_COVERAGE_CHOICES.find(option => option.value === props.value)?.description ??
        AI_COVERAGE_CHOICES[2].description),
    ]);
  },
});
