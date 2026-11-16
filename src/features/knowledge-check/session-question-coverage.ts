import { defineComponent, h, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { questionReady, type Question } from './question-model.ts';

const PASS_COLORS = ['#1675c2', '#24834e', '#cc7900', '#c53c48', '#8450b6', '#161616'];

/** Show actual bank coverage across Study, Quiz and Test, not just this session's size. */
export const SessionQuestionCoverage = defineComponent({
  name: 'SessionQuestionCoverage',
  props: {
    questions: { type: Array as PropType<readonly Question[]>, required: true },
    selected: { type: Number, required: true },
  },
  setup(props) {
    return () => {
      const bank = props.questions.filter(questionReady);
      const available = bank.length;
      if (!available || props.selected < 1) return null;
      const completed = bank.reduce((least, question) => Math.min(least, question.shownCount ?? 0), Infinity);
      const covered = bank.filter(question => (question.shownCount ?? 0) > completed).length;
      const previousColor = completed > 0 ? PASS_COLORS[(completed - 1) % PASS_COLORS.length]! : 'var(--border-color)';
      const nextColor = PASS_COLORS[completed % PASS_COLORS.length]!;
      // Two ticks per round needed to cover the largest balanced group.
      const tickCount = 2 * Math.ceil(available / props.selected);
      const segments = tickCount * covered / available;
      return h('section', { class: 'knowledge-question-coverage', 'aria-label': 'Question bank coverage' }, [
        h('div', { class: 'knowledge-question-coverage-heading' }, [
          h(Icon, { name: 'shuffle' }), h('strong', `${props.selected} of ${available} questions this time`),
        ]),
        h('div', { class: 'knowledge-question-coverage-track', role: 'progressbar',
          style: { gridTemplateColumns: `repeat(${tickCount}, minmax(0, 1fr))`, columnGap: `min(4px, ${20 / tickCount}%)` },
          'aria-label': 'Current coverage pass', 'aria-valuemin': 0, 'aria-valuemax': available,
          'aria-valuenow': covered, 'aria-valuetext': `${completed} full passes; ${covered} of ${available} questions in the next pass`,
        }, Array.from({ length: tickCount }, (_, i) => {
          const fill = Math.max(0, Math.min(1, segments - i)) * 100;
          return h('span', { key: i, style: {
            background: fill === 0 ? previousColor : fill === 100 ? nextColor :
              `linear-gradient(to right, ${nextColor} ${fill}%, ${previousColor} ${fill}%)`,
          } });
        })),
        h('p', { class: 'knowledge-question-coverage-count' }, [
          h('strong', `${completed} full ${completed === 1 ? 'pass' : 'passes'} completed`),
          ` · Pass ${completed + 1}: ${covered} of ${available} questions shown`,
        ]),
        h('p', 'Each session samples evenly across the bank, preferring the least-shown questions in each group and randomly choosing among ties. Progress is shared across Study, Quiz and Test.'),
        h('p', 'The bar changes color each time every available question has been shown another time. Questions count once per session, not per answer attempt.'),
      ]);
    };
  },
});
