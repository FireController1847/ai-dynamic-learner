import { defineComponent, h, ref, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { choicePoolProblem, MAX_CHOICE_POOL_TERMS, type Question } from './question-model.ts';

/** Optional variable distractors for authored Multiple Choice questions. */
export const MultipleChoicePoolEditor = defineComponent({
  name: 'MultipleChoicePoolEditor',
  props: { question: { type: Object as PropType<Question>, required: true } },
  setup(props) {
    const text = ref(props.question.choicePool?.distractors.join('\n') ?? '');
    return () => {
      const question = props.question, pool = question.choicePool;
      const correct = question.correctAnswers ?? (question.answer ? [question.answer] : []);
      const baseWrong = question.choices.filter(choice => choice.trim() && !correct.includes(choice));
      return h('section', { class: 'knowledge-choice-pool-editor' }, [
        h('label', { class: 'knowledge-option-toggle' }, [
          h('input', {
            type: 'checkbox', checked: Boolean(pool),
            onChange: (event: Event) => {
              if ((event.target as HTMLInputElement).checked) {
                question.choicePool = {
                  displayCount: Math.min(4, Math.max(2, question.choices.filter(choice => choice.trim()).length)),
                  distractors: [],
                };
                text.value = '';
              } else delete question.choicePool;
            },
          }),
          'Vary incorrect choices between sessions',
        ]),
        pool ? h('div', { class: 'knowledge-choice-pool-settings' }, [
          h('p', { class: 'knowledge-muted' },
            'All correct choices are always included. The remaining slots draw randomly from the incorrect choices above and the additional terms below. A new session gets a new selection; paused attempts keep theirs.'),
          h('label', { class: 'knowledge-field' }, [
            'Answer options shown per question',
            h('input', {
              type: 'number', min: 2, max: 8, step: 1, value: pool.displayCount,
              onInput: (event: Event) => { pool.displayCount = Number(inputValue(event)); },
            }),
          ]),
          h('label', { class: 'knowledge-field' }, [
            'Additional incorrect terms (one per line)',
            h('textarea', {
              rows: 6, value: text.value, placeholder: 'Alternative incorrect answer\nAnother plausible distractor',
              onInput: (event: Event) => {
                text.value = inputValue(event);
                pool.distractors = text.value.split(/\r?\n/u).map(term => term.trim()).filter(Boolean);
              },
            }),
          ]),
          h('p', { class: 'knowledge-muted' },
            `${correct.length} correct · ${baseWrong.length + pool.distractors.length} possible incorrect · ${pool.displayCount} displayed total · up to ${MAX_CHOICE_POOL_TERMS} additional terms`),
          choicePoolProblem(question) ? h('p', { class: 'knowledge-message', role: 'status' },
            choicePoolProblem(question)) : null,
        ]) : null,
      ]);
    };
  },
});
