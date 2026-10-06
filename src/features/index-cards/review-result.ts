import { defineComponent, h } from 'vue';

export const ReviewResult = defineComponent({
  name: 'ReviewResult',
  props: {
    correct: { type: Number, required: true },
    total: { type: Number, required: true },
    summary: { type: String, required: true },
  },
  emits: { done: () => true, 'review-again': () => true },
  setup(props, { emit }) {
    return () => {
      const percentage = props.total > 0 ? Math.round((props.correct / props.total) * 100) : null;
      return h('section', {
        class: 'card-review-result',
        'aria-label': 'Review result',
        'aria-live': 'polite',
      }, [
        h('p', { class: 'card-review-result-eyebrow' }, 'Review complete'),
        h('p', { class: 'card-review-result-score' }, percentage === null ? '—' : `${percentage}%`),
        h('p', { class: 'card-review-result-summary' }, props.summary),
        h('div', { class: 'card-review-result-actions' }, [
          h('button', {
            type: 'button',
            class: 'quiet-button',
            onClick: () => emit('done'),
          }, 'Back to cards'),
          h('button', {
            type: 'button',
            class: 'card-primary-button',
            onClick: () => emit('review-again'),
          }, 'Review again'),
        ]),
      ]);
    };
  },
});
