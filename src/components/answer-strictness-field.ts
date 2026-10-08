import {
  isAnswerStrictness,
  type AnswerStrictness,
} from '../../packages/@dynamic-learner/answer-matching/src/index.ts';
import { inputValue } from '../core/dom.ts';

import { defineComponent, h, type PropType } from 'vue';

export const AnswerStrictnessField = defineComponent({
  name: 'AnswerStrictnessField',
  props: {
    id: { type: String, required: true },
    label: { type: String, default: 'Answer strictness' },
    value: { type: Number as PropType<AnswerStrictness>, required: true },
    fieldClass: { type: String, default: 'knowledge-field' },
  },
  emits: { change: (_value: AnswerStrictness) => true },
  setup(props, { emit }) {
    return () => h('label', { class: props.fieldClass, for: props.id }, [
      props.label,
      h('select', {
        id: props.id,
        value: props.value,
        onChange: (event: Event) => {
          const value = Number(inputValue(event));
          if (isAnswerStrictness(value)) emit('change', value);
        },
      }, [
        h('option', { value: 1 }, '1 — Strict'),
        h('option', { value: 2 }, '2 — Flexible'),
        h('option', { value: 3 }, '3 — Linguistic'),
        h('option', { value: 4 }, '4 — Semantic'),
      ]),
    ]);
  },
});
