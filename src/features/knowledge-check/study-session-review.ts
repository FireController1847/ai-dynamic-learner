import { defineComponent, h, type PropType } from 'vue';
import {
  answerCorrect, questionDisplayPrompt, questionScored, type Question, type QuestionResponse,
} from './question-model.ts';
import { answerStrictnessForQuestion, type SessionSettings } from './session-settings.ts';

/** Read-only summary of the active Study round. No grading side effects. */
export const StudySessionReview = defineComponent({
  name: 'StudySessionReview',
  props: {
    questions: { type: Array as PropType<Question[]>, required: true },
    attempts: { type: Object as PropType<Record<string, number>>, required: true },
    feedbackResponses: { type: Object as PropType<Record<string, QuestionResponse>>, required: true },
    hints: { type: Object as PropType<Set<string>>, required: true },
    revealed: { type: Object as PropType<Set<string>>, required: true },
    studyChecks: { type: Number, required: true },
    studyCorrectChecks: { type: Number, required: true },
    settings: { type: Object as PropType<SessionSettings>, required: true },
    restarting: Boolean,
    readOnly: Boolean,
    completedAt: Number,
  },
  emits: {
    back: (_event: MouseEvent) => true,
    end: () => true,
    continue: (_event: MouseEvent) => true,
  },
  setup(props, { emit }) {
    function reviewActions() {
      if (props.readOnly) return h('div', { class: 'knowledge-study-review-actions' }, [
        h('button', { type: 'button', class: 'quiet-button',
          onClick: (event: MouseEvent) => emit('back', event) }, 'Back to Study'),
      ]);
      return h('div', { class: 'knowledge-study-review-actions' }, [
        h('button', { type: 'button', class: 'quiet-button',
          onClick: (event: MouseEvent) => emit('back', event) }, 'Back to questions'),
        h('div', { class: 'knowledge-study-finish-actions' }, [
          h('button', { type: 'button', class: 'quiet-button',
            onClick: () => emit('end') }, 'End studying'),
          h('button', { type: 'button', class: 'card-primary-button knowledge-keep-studying',
            disabled: props.restarting, onClick: (event: MouseEvent) => emit('continue', event) }, 'Keep studying'),
        ]),
      ]);
    }

    return () => {
      const checkedQuestions = props.questions.filter(question => (props.attempts[question.id] ?? 0) > 0).length;
      const correctChecks = props.studyCorrectChecks;
      const totalChecks = props.studyChecks;
      const incorrectChecks = Math.max(0, totalChecks - correctChecks);
      const accuracy = totalChecks ? Math.round(correctChecks / totalChecks * 100) : null;
      const hintsUsed = props.questions.filter(question => props.hints.has(question.id)).length;
      const answersRevealed = props.questions.filter(question => props.revealed.has(question.id)).length;
      const metrics = [
        { title: 'Total checks', value: totalChecks },
        { title: 'Correct checks', value: correctChecks },
        { title: 'Incorrect checks', value: incorrectChecks },
        { title: 'Questions practiced', value: checkedQuestions + ' / ' + props.questions.length },
        { title: 'Hints open', value: hintsUsed },
        { title: 'Answers revealed', value: answersRevealed },
      ];
      return h('section', {
        class: 'knowledge-session knowledge-study-review',
        'aria-label': 'Study session review',
        'data-review-focus': '', tabindex: -1,
      }, [
        h('header', { class: 'knowledge-study-review-heading' }, [
          h('p', { class: 'knowledge-eyebrow' }, 'Study session'),
          h('h2', 'Review study session'),
          h('p', { class: 'knowledge-muted' },
            'Here’s how this round went. These are practice checks, not a graded test score.'),
          props.readOnly && props.completedAt
            ? h('p', { class: 'knowledge-muted' },
              'Saved ' + new Date(props.completedAt).toLocaleString() + ' · Only the latest Study session is retained.')
            : null,
        ]),
        reviewActions(),
        h('div', { class: 'knowledge-study-review-overview' }, [
          h('div', { class: 'knowledge-study-review-accuracy' }, [
            h('span', { class: 'knowledge-study-review-accuracy-value' }, accuracy === null ? '—' : accuracy + '%'),
            h('span', { class: 'knowledge-muted' }, 'Check accuracy'),
          ]),
          h('div', { class: 'knowledge-study-review-progress' }, [
            h('div', { class: 'knowledge-study-review-progress-label' }, [
              h('strong', 'Questions practiced'),
              h('span', checkedQuestions + ' of ' + props.questions.length),
            ]),
            h('div', {
              class: 'knowledge-study-review-progress-track', role: 'progressbar',
              'aria-label': 'Questions practiced',
              'aria-valuemin': 0, 'aria-valuemax': props.questions.length,
              'aria-valuenow': checkedQuestions,
            }, [h('span', { style: { width: (props.questions.length
              ? checkedQuestions / props.questions.length * 100 : 0) + '%' } })]),
            h('p', { class: 'knowledge-muted' },
              totalChecks ? 'Correct and incorrect counts include retries.' : 'No answers were checked this round.'),
          ]),
        ]),
        h('div', { class: 'knowledge-study-review-metrics', 'aria-label': 'Study statistics' },
          metrics.map(metric => h('div', { class: 'knowledge-study-review-metric', key: metric.title }, [
            h('strong', String(metric.value)),
            h('span', metric.title),
          ]))),
        h('section', { class: 'knowledge-study-review-breakdown', 'aria-label': 'Question breakdown' }, [
          h('h3', 'Question breakdown'),
          h('ol', { class: 'knowledge-study-review-list' }, props.questions.map((question, index) => {
            const checks = props.attempts[question.id] ?? 0;
            const lastResponse = props.feedbackResponses[question.id];
            const lastCorrect = checks > 0 && lastResponse !== undefined && answerCorrect(
              question, lastResponse, answerStrictnessForQuestion(props.settings, question.type));
            const status = !questionScored(question) ? 'Not scored'
              : checks === 0 ? 'Not checked'
                : lastCorrect ? 'Last check correct' : 'Last check incorrect';
            return h('li', { class: 'knowledge-study-review-question', key: question.id }, [
              h('div', { class: 'knowledge-study-review-question-copy' }, [
                h('strong', 'Question ' + (index + 1)),
                h('p', questionDisplayPrompt(question)),
                h('span', { class: 'knowledge-muted' }, [
                  checks + (checks === 1 ? ' check' : ' checks'),
                  props.hints.has(question.id) ? ' · Hint open' : '',
                  props.revealed.has(question.id) ? ' · Answer revealed' : '',
                ]),
              ]),
              h('span', { class: ['knowledge-study-review-question-status', {
                'is-correct': checks > 0 && lastCorrect,
                'is-incorrect': checks > 0 && !lastCorrect,
              }] }, status),
            ]);
          })),
        ]),
        reviewActions(),
      ]);
    };
  },
});
