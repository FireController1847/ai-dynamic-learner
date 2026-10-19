import { defineComponent, h, type PropType } from 'vue';
import type { ReviewAttempt } from './attempt-history.ts';

export const ReviewAttemptHistory = defineComponent({
  name: 'ReviewAttemptHistory',
  props: {
    setName: { type: String, required: true },
    attempts: { type: Array as PropType<ReviewAttempt[]>, required: true },
  },
  emits: { back: () => true, open: (_attempt: ReviewAttempt) => true },
  setup(props, { emit }) {
    return () => {
      const ordered = [...props.attempts].reverse();
      return h('section', { class: 'knowledge-check-builder knowledge-attempt-history', 'aria-label': 'Quiz and test history' }, [
        h('header', { class: 'knowledge-check-builder-intro' }, [
          h('p', { class: 'knowledge-check-builder-eyebrow' }, 'Knowledge set history'),
          h('h2', 'Quiz & Test History'),
          h('p', props.setName),
          h('p', 'Review completed attempts without changing your recorded answers or scores.'),
          h('p', { class: 'knowledge-muted' },
            'Study sessions are not recorded here. Only the most recent Study session is saved, and you can review it from the Study start screen.'),
        ]),
        h('div', { class: 'knowledge-attempt-history-toolbar' }, [
          h('p', { class: 'knowledge-muted' }, ordered.length + (ordered.length === 1 ? ' completed attempt' : ' completed attempts')),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back to knowledge set'),
        ]),
        ordered.length
          ? h('ol', { class: 'knowledge-attempt-history-list' }, ordered.map(attempt => h('li', {
            key: attempt.id, class: 'knowledge-attempt-history-item',
          }, [
            h('div', { class: 'knowledge-attempt-history-details' }, [
              h('strong', attempt.mode === 'test' ? 'Test' : 'Quiz'),
              h('time', { datetime: new Date(attempt.completedAt).toISOString() }, new Date(attempt.completedAt).toLocaleString()),
              h('span', { class: 'knowledge-muted' }, attempt.questions.length +
                (attempt.questions.length === 1 ? ' question' : ' questions') +
                (attempt.expired ? ' · Time expired' : '')),
            ]),
            h('span', { class: 'knowledge-attempt-history-score' },
              attempt.score + ' / ' + attempt.scoredCount +
              (attempt.scoredCount ? ' · ' + Math.round(attempt.score / attempt.scoredCount * 100) + '%' : '')),
            h('button', {
              type: 'button', class: 'quiet-button',
              'aria-label': 'Review ' + attempt.mode + ' from ' + new Date(attempt.completedAt).toLocaleString(),
              onClick: () => emit('open', attempt),
            }, 'Review'),
          ])))
          : h('p', { class: 'knowledge-muted' }, 'No completed quizzes or tests yet. Finished attempts will appear here.'),
      ]);
    };
  },
});
