import type { AnswerStrictness } from '../../../packages/@dynamic-learner/answer-matching/src/index.ts';
import { defineComponent, h, type PropType } from 'vue';
import { AnswerStrictnessField } from '../../components/answer-strictness-field.ts';
import { inputValue } from '../../core/dom.ts';
import { MAX_QUESTIONS, MAX_TEXT } from './question-model.ts';
import type { QuestionOrder, SetOptions } from './set-options.ts';

export const SetOptionsEditor = defineComponent({
  name: 'KnowledgeSetOptions',
  props: {
    options: { type: Object as PropType<SetOptions>, required: true },
    questionCount: { type: Number, required: true },
  },
  setup(props) {
    return () => h('section', { class: 'knowledge-options', 'aria-label': 'Set options' }, [
      h('h3', 'Set options'),
      h('label', { class: 'knowledge-field' }, ['Description (optional)', h('textarea', {
        rows: 4, maxlength: MAX_TEXT, value: props.options.description,
        onInput: (event: Event) => { props.options.description = inputValue(event); },
      })]),
      h('p', { class: 'knowledge-muted' }, 'Shown before starting a Quiz or Test. Explain the topic or what to expect.'),

      h('h3', 'Answer matching'),
      h(AnswerStrictnessField, {
        id: 'knowledge-short-answer-strictness',
        label: 'Short Answer strictness',
        value: props.options.shortAnswerStrictness,
        onChange: (value: AnswerStrictness) => { props.options.shortAnswerStrictness = value; },
      }),
      h(AnswerStrictnessField, {
        id: 'knowledge-fill-blank-strictness',
        label: 'Fill in the Blanks strictness',
        value: props.options.fillBlankAnswerStrictness,
        onChange: (value: AnswerStrictness) => { props.options.fillBlankAnswerStrictness = value; },
      }),
      h('p', { class: 'knowledge-muted' },
        'These are independent. Level 1 requires normalized exact answers; higher levels add spelling tolerance, linguistic equivalents, and then conservative semantic equivalents.'),

      h('h3', 'Quiz & Test defaults'),
      h('label', { class: 'knowledge-field' }, ['Question order', h('select', {
        value: props.options.assessmentOrder,
        onChange: (event: Event) => { props.options.assessmentOrder = inputValue(event) as QuestionOrder; },
      }, [
        h('option', { value: 'forward' }, 'In order'),
        h('option', { value: 'backward' }, 'Reverse order'),
        h('option', { value: 'shuffle' }, 'Shuffle'),
      ])]),
      h('label', { class: 'knowledge-option-toggle' }, [h('input', {
        type: 'checkbox',
        checked: props.options.assessmentQuestionLimit !== null,
        onChange: (event: Event) => {
          props.options.assessmentQuestionLimit = (event.target as HTMLInputElement).checked
            ? Math.min(Math.max(1, props.questionCount || 1), 10)
            : null;
        },
      }), 'Limit the number of questions']),
      props.options.assessmentQuestionLimit !== null ? h('label', { class: 'knowledge-field' }, [
        'Maximum questions',
        h('input', {
          type: 'number', min: 1, max: MAX_QUESTIONS, step: 1, required: true,
          value: props.options.assessmentQuestionLimit,
          onInput: (event: Event) => { props.options.assessmentQuestionLimit = Number(inputValue(event)); },
        }),
      ]) : null,
      h('p', { class: 'knowledge-muted' }, 'The limit is applied after ordering. If the set has fewer questions, all available questions are used.'),
      h('label', { class: 'knowledge-option-toggle' }, [h('input', {
        type: 'checkbox', checked: props.options.shuffleChoices,
        onChange: (event: Event) => { props.options.shuffleChoices = (event.target as HTMLInputElement).checked; },
      }), 'Shuffle multiple-choice answer choices']),
      h('p', { class: 'knowledge-muted' }, 'These defaults are fixed for Test. Quiz uses them unless you choose Customize Settings before starting.'),

      h('h3', 'Quiz settings'),
      h('label', { class: 'knowledge-field' }, ['Allowed attempts per question', h('input', {
        type: 'number', min: 1, step: 1, required: true, value: props.options.quizAttempts,
        onInput: (event: Event) => { props.options.quizAttempts = Number(inputValue(event)); },
      })]),
      h('p', { class: 'knowledge-muted' }, 'Quiz uses this by default, but you can change it for an individual Quiz session.'),

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
      h('p', { class: 'knowledge-muted' }, 'Turn this off for score-only Test results. Test settings cannot be changed when starting a Test.'),
    ]);
  },
});
