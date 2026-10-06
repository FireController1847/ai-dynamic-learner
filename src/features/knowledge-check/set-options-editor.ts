import { defineComponent, h, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { MAX_TEXT } from './question-model.ts';
import type { SetOptions } from './set-options.ts';

export const SetOptionsEditor = defineComponent({
  name: 'KnowledgeSetOptions',
  props: { options: { type: Object as PropType<SetOptions>, required: true } },
  setup(props) {
    return () => h('section', { class: 'knowledge-options', 'aria-label': 'Set options' }, [
      h('h3', 'Set options'),
      h('label', { class: 'knowledge-field' }, ['Description (optional)', h('textarea', {
        rows: 4, maxlength: MAX_TEXT, value: props.options.description,
        onInput: (event: Event) => { props.options.description = inputValue(event); },
      })]),
      h('p', { class: 'knowledge-muted' }, 'Shown before starting a Quiz or Test. Explain the topic or what to expect.'),
      h('h3', 'Quiz settings'),
      h('label', { class: 'knowledge-field' }, ['Allowed attempts per question', h('input', {
        type: 'number', min: 1, step: 1, required: true, value: props.options.quizAttempts,
        onInput: (event: Event) => { props.options.quizAttempts = Number(inputValue(event)); },
      })]),
      h('p', { class: 'knowledge-muted' }, 'A correct answer finishes the question immediately. Incorrect answers can be retried until this many attempts have been used.'),
      h('h3', 'Test settings'),
      h('label', { class: 'knowledge-option-toggle' }, [h('input', {
        type: 'checkbox', checked: props.options.timeLimitMinutes !== null,
        onChange: (event: Event) => { props.options.timeLimitMinutes = (event.target as HTMLInputElement).checked ? 15 : null; },
      }), 'Use a time limit']),
      props.options.timeLimitMinutes !== null ? h('label', { class: 'knowledge-field' }, ['Time limit (minutes)', h('input', {
        type: 'number', min: 1, max: 1440, step: 1, required: true, value: props.options.timeLimitMinutes,
        onInput: (event: Event) => { props.options.timeLimitMinutes = Number(inputValue(event)); },
      })]) : null,
      h('p', { class: 'knowledge-muted' }, 'The clock starts when you press Start test. When time runs out, your current answers are submitted.'),
      h('label', { class: 'knowledge-option-toggle' }, [h('input', {
        type: 'checkbox', checked: props.options.showTestAnswers,
        onChange: (event: Event) => { props.options.showTestAnswers = (event.target as HTMLInputElement).checked; },
      }), 'Show correct/wrong answers after the Test']),
      h('p', { class: 'knowledge-muted' }, 'Turn this off for score-only Test results. Quiz always explains answers as you go.'),
    ]);
  },
});
