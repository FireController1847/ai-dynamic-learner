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
    beforeSession: Boolean,
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
      // At a pass boundary, label the fully colored bar as the completed pass,
      // not as an empty future pass in a different color.
      const atBoundary = completed > 0 && covered === 0;
      const displayedPass = atBoundary ? completed : completed + 1;
      const displayedCount = atBoundary ? available : covered;
      const displayedColor = atBoundary ? previousColor : nextColor;
      const passStatus = atBoundary ? 'complete' : covered > 0 ? 'in progress' : 'not started';
      const times = displayedPass === 1 ? 'once' : displayedPass === 2 ? 'twice' : `${displayedPass.toLocaleString()} times`;
      const exposure = `${displayedCount.toLocaleString()} of ${available.toLocaleString()} questions seen at least ${times}`;
      const heading = props.beforeSession ? 'Coverage before this session' : 'Coverage so far';
      // Two ticks per round needed to cover the largest balanced group.
      const tickCount = 2 * Math.ceil(available / props.selected);
      const segments = tickCount * covered / available;
      return h('section', { class: 'knowledge-question-coverage', 'aria-label': heading }, [
        h('div', { class: 'knowledge-question-coverage-heading' }, [
          h(Icon, { name: 'shuffle' }), h('strong', heading),
          h('span', { class: 'knowledge-question-coverage-passes' }, `${completed.toLocaleString()} full-bank ${completed === 1 ? 'pass' : 'passes'} completed`),
        ]),
        h('div', { class: 'knowledge-question-coverage-track', role: 'progressbar',
          style: { gridTemplateColumns: `repeat(${tickCount}, minmax(0, 1fr))`, columnGap: `min(4px, ${20 / tickCount}%)` },
          'aria-label': `Pass ${displayedPass} coverage so far`, 'aria-valuemin': 0, 'aria-valuemax': available,
          'aria-valuenow': displayedCount, 'aria-valuetext': `Pass ${displayedPass} ${passStatus}; ${exposure}`,
        }, Array.from({ length: tickCount }, (_, i) => {
          const fill = Math.max(0, Math.min(1, segments - i)) * 100;
          return h('span', { key: i, style: {
            background: fill === 0 ? previousColor : fill === 100 ? nextColor :
              `linear-gradient(to right, ${nextColor} ${fill}%, ${previousColor} ${fill}%)`,
          } });
        })),
        h('div', { class: 'knowledge-question-coverage-count' }, [
          h('span', { class: 'knowledge-question-coverage-pass' }, [
            h('span', { class: 'knowledge-question-coverage-color', style: { background: displayedColor }, 'aria-hidden': 'true' }),
            `Pass ${displayedPass} · ${passStatus}`,
          ]),
          h('span', exposure),
        ]),
      ]);
    };
  },
});
