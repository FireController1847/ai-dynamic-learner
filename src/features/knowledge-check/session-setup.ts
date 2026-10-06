import { defineComponent, h, ref, type PropType } from 'vue';
import type { CheckItem } from './library-model.ts';
import type { CheckModeId } from './check-types.ts';
import { QUESTION_ORDER_LABELS, settingsForMode, type SessionSettings } from './session-settings.ts';
import type { QuestionOrder } from './set-options.ts';
import { inputValue } from '../../core/dom.ts';

type QuizSetupChoice = 'default' | 'customize';

export const SessionSetup = defineComponent({
  name: 'KnowledgeSessionSetup',
  props: {
    item: { type: Object as PropType<CheckItem>, required: true },
    mode: { type: String as PropType<CheckModeId>, required: true },
    questionCount: { type: Number, required: true },
  },
  emits: {
    back: () => true,
    continue: (_settings: SessionSettings) => true,
  },
  setup(props, { emit }) {
    const defaults = settingsForMode(props.item.options, props.mode);
    const studyOrder = ref<QuestionOrder>('forward');
    const quizChoice = ref<QuizSetupChoice>('default');
    const customizing = ref(false);
    const custom = ref<SessionSettings>({ ...defaults });
    const limited = ref(custom.value.questionLimit !== null);
    const customLimit = ref(custom.value.questionLimit ?? Math.min(10, Math.max(1, props.questionCount)));

    function orderChoice(order: QuestionOrder, label: string, description: string, value: QuestionOrder, onSelect: () => void, name: string) {
      return h('label', { class: 'knowledge-session-choice', key: order }, [
        h('input', {
          type: 'radio',
          name,
          value: order,
          checked: value === order,
          onChange: onSelect,
        }),
        h('span', [
          h('strong', label),
          h('span', { class: 'knowledge-session-choice-description' }, description),
        ]),
      ]);
    }

    function defaultSummary() {
      const count = defaults.questionLimit === null
        ? 'all questions'
        : `up to ${defaults.questionLimit} questions`;
      return `${QUESTION_ORDER_LABELS[defaults.order]}, ${count}, ${defaults.shuffleChoices ? 'shuffled' : 'original'} answer-choice order, ${defaults.quizAttempts} ${defaults.quizAttempts === 1 ? 'attempt' : 'attempts'} per question.`;
    }

    function emitStudy() {
      emit('continue', {
        ...settingsForMode(props.item.options, 'study'),
        order: studyOrder.value,
      });
    }

    function emitCustomQuiz() {
      custom.value.questionLimit = limited.value ? Math.max(1, Math.min(props.questionCount, customLimit.value || 1)) : null;
      emit('continue', { ...custom.value });
    }

    if (props.mode === 'study') {
      return () => h('section', { class: 'knowledge-session knowledge-session-setup', 'aria-label': 'Study setup' }, [
        h('p', { class: 'knowledge-session-setup-step' }, `Set up Study · ${props.questionCount} ${props.questionCount === 1 ? 'question' : 'questions'}`),
        h('h2', 'What order should the questions use?'),
        h('p', { class: 'knowledge-session-setup-description' }, 'Choose an order for this Study session. You will choose again the next time you start studying.'),
        h('fieldset', { class: 'knowledge-session-choices' }, [
          h('legend', { class: 'visually-hidden' }, 'Study question order'),
          orderChoice('forward', 'In order', 'Start with the first question and continue normally.', studyOrder.value, () => { studyOrder.value = 'forward'; }, 'study-question-order'),
          orderChoice('backward', 'Reverse order', 'Start with the last question and work backward.', studyOrder.value, () => { studyOrder.value = 'backward'; }, 'study-question-order'),
          orderChoice('shuffle', 'Shuffle', 'Use a new random question order for this session.', studyOrder.value, () => { studyOrder.value = 'shuffle'; }, 'study-question-order'),
        ]),
        h('div', { class: 'knowledge-session-setup-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back'),
          h('button', { type: 'button', class: 'card-primary-button', onClick: emitStudy }, 'Continue'),
        ]),
      ]);
    }

    return () => {
      if (!customizing.value) {
        return h('section', { class: 'knowledge-session knowledge-session-setup', 'aria-label': 'Quiz setup' }, [
          h('p', { class: 'knowledge-session-setup-step' }, `Set up Quiz · ${props.questionCount} ${props.questionCount === 1 ? 'question' : 'questions'} available`),
          h('h2', 'How should this Quiz run?'),
          h('p', { class: 'knowledge-session-setup-description' }, 'Use the settings saved with this knowledge set, or customize only this Quiz session.'),
          h('fieldset', { class: 'knowledge-session-choices' }, [
            h('legend', { class: 'visually-hidden' }, 'Quiz settings source'),
            h('label', { class: 'knowledge-session-choice' }, [
              h('input', {
                type: 'radio', name: 'quiz-setup-choice', value: 'default',
                checked: quizChoice.value === 'default', onChange: () => { quizChoice.value = 'default'; },
              }),
              h('span', [
                h('strong', 'Default Settings'),
                h('span', { class: 'knowledge-session-choice-description' }, defaultSummary()),
              ]),
            ]),
            h('label', { class: 'knowledge-session-choice' }, [
              h('input', {
                type: 'radio', name: 'quiz-setup-choice', value: 'customize',
                checked: quizChoice.value === 'customize', onChange: () => { quizChoice.value = 'customize'; },
              }),
              h('span', [
                h('strong', 'Customize Settings'),
                h('span', { class: 'knowledge-session-choice-description' }, 'Temporarily change order, question count, answer-choice shuffling, or allowed attempts.'),
              ]),
            ]),
          ]),
          h('div', { class: 'knowledge-session-setup-actions' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back'),
            h('button', {
              type: 'button',
              class: 'card-primary-button',
              onClick: () => {
                if (quizChoice.value === 'default') emit('continue', { ...defaults });
                else customizing.value = true;
              },
            }, 'Continue'),
          ]),
        ]);
      }

      return h('section', { class: 'knowledge-session knowledge-session-setup', 'aria-label': 'Customize Quiz settings' }, [
        h('p', { class: 'knowledge-session-setup-step' }, 'Customize Quiz · Session only'),
        h('h2', 'Customize Quiz settings'),
        h('p', { class: 'knowledge-session-setup-description' }, 'These changes apply only to this Quiz and do not change the saved knowledge set.'),
        h('fieldset', { class: 'knowledge-session-choices' }, [
          h('legend', 'Question order'),
          orderChoice('forward', 'In order', 'Use the original question order.', custom.value.order, () => { custom.value.order = 'forward'; }, 'quiz-question-order'),
          orderChoice('backward', 'Reverse order', 'Run the saved question order backward.', custom.value.order, () => { custom.value.order = 'backward'; }, 'quiz-question-order'),
          orderChoice('shuffle', 'Shuffle', 'Use a new random question order.', custom.value.order, () => { custom.value.order = 'shuffle'; }, 'quiz-question-order'),
        ]),
        h('label', { class: 'knowledge-option-toggle' }, [
          h('input', {
            type: 'checkbox',
            checked: limited.value,
            onChange: (event: Event) => { limited.value = (event.target as HTMLInputElement).checked; },
          }),
          'Limit the number of questions',
        ]),
        limited.value ? h('label', { class: 'knowledge-field' }, [
          'Questions in this Quiz',
          h('input', {
            type: 'number', min: 1, max: Math.max(1, props.questionCount), step: 1,
            value: customLimit.value,
            onInput: (event: Event) => { customLimit.value = Number(inputValue(event)); },
          }),
        ]) : null,
        h('label', { class: 'knowledge-option-toggle' }, [
          h('input', {
            type: 'checkbox',
            checked: custom.value.shuffleChoices,
            onChange: (event: Event) => { custom.value.shuffleChoices = (event.target as HTMLInputElement).checked; },
          }),
          'Shuffle multiple-choice answer choices',
        ]),
        h('label', { class: 'knowledge-field' }, [
          'Allowed attempts per question',
          h('input', {
            type: 'number', min: 1, step: 1, value: custom.value.quizAttempts,
            onInput: (event: Event) => { custom.value.quizAttempts = Math.max(1, Number(inputValue(event)) || 1); },
          }),
        ]),
        h('div', { class: 'knowledge-session-setup-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { customizing.value = false; } }, 'Back'),
          h('button', { type: 'button', class: 'card-primary-button', onClick: emitCustomQuiz }, 'Continue'),
        ]),
      ]);
    };
  },
});
