import { defineComponent, h, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import type { CheckModeId } from './check-types.ts';
import type { QuestionOrder } from './set-options.ts';

/** Explain that the saved question bank and a single session are different sizes. */
export const SessionQuestionCoverage = defineComponent({
  name: 'SessionQuestionCoverage',
  props: {
    available: { type: Number, required: true },
    selected: { type: Number, required: true },
    mode: { type: String as PropType<CheckModeId>, required: true },
    order: { type: String as PropType<QuestionOrder>, required: true },
  },
  setup(props) {
    return () => {
      if (props.available <= props.selected || props.selected < 1) return null;
      const isStudy = props.mode === 'study';
      const shuffled = props.order === 'shuffle';
      const explanation = isStudy
        ? 'Study draws a fresh, balanced sample from across the full question bank. A new Study session can show different questions.'
        : shuffled
          ? 'This session takes questions after shuffling the bank. Another session can give you a different mix.'
          : 'This session takes questions in the selected order. Shuffling the order in set options can vary which questions appear.';
      return h('section', { class: 'knowledge-question-coverage', 'aria-label': 'How questions are selected' }, [
        h('div', { class: 'knowledge-question-coverage-heading' }, [
          h(Icon, { name: 'shuffle' }), h('strong', `${props.selected} of ${props.available} questions this time`),
        ]),
        h('div', { class: 'knowledge-question-coverage-track', 'aria-hidden': 'true' },
          Array.from({ length: 12 }, (_, i) => h('span', {
            class: i < Math.round(12 * props.selected / props.available) ? 'is-picked' : '',
          }))),
        h('p', explanation),
        h('p', 'Your other questions are still saved. Repeating sessions reinforces learning; with shuffled questions or a different session limit, you can cover more of the bank.'),
      ]);
    };
  },
});
