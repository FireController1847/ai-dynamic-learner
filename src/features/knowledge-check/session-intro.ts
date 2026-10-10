import { defineComponent, h, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { EntryStatistics } from '../../components/entry-statistics.ts';
import { CHECK_MODES, type CheckModeId } from './check-types.ts';
import type { CheckItem } from './library-model.ts';
import { defaultSetOptions } from './set-options.ts';
import { QUESTION_ORDER_LABELS, type SessionSettings } from './session-settings.ts';

export const SessionIntro = defineComponent({
  name: 'KnowledgeSessionIntro',
  props: { item: { type: Object as PropType<CheckItem>, required: true },
    mode: { type: String as PropType<CheckModeId>, required: true },
    settings: { type: Object as PropType<SessionSettings>, required: true },
    count: { type: Number, required: true }, ended: Boolean, resumable: Boolean, message: String },
  emits: { back: () => true, start: () => true, resume: () => true },
  setup(props, { emit }) {
    return () => {
      const test = props.mode === 'test';
      const study = props.mode === 'study';
      const mode = CHECK_MODES.find(entry => entry.id === props.mode)!;
      const options = { ...defaultSetOptions(), ...props.item.options };
      const settings = props.settings;
      const pill = (icon: string, label: string) => h('span', { class: 'knowledge-info-pill' }, [h(Icon, { name: icon }), label]);
      return h('section', { class: ['knowledge-session knowledge-session-intro', `is-${props.mode}`],
        'data-mode': props.mode, 'aria-label': `${mode.label} information` }, [
        h('header', { class: 'knowledge-intro-header' }, [
          h('div', { class: 'knowledge-intro-art', 'aria-hidden': 'true' }, [
            h('div', { class: 'knowledge-intro-sheet' }, [h(Icon, { name: mode.icon })]),
            h('span', { class: 'knowledge-intro-badge' }, [h(Icon, { name: study ? 'lightbulb' : test ? 'verified' : 'check' })]),
          ]),
          h('div', { class: 'knowledge-intro-title' }, [
            h('p', { class: 'knowledge-intro-mode' }, mode.label), h('h3', props.item.name),
            h('p', mode.description),
          ]),
        ]),
        h('div', { class: 'knowledge-intro-pills', 'aria-label': 'Session details' }, [
          pill('cards', `${props.count} ${props.count === 1 ? 'question' : 'questions'}`),
          pill('shuffle', QUESTION_ORDER_LABELS[settings.order]),
          pill('cards', settings.presentation === 'scroll' ? 'All questions visible' : 'One at a time'),
          pill(test ? 'clock' : study ? 'lightbulb' : 'check',
            test
              ? settings.timeLimitMinutes !== null
                ? `${settings.timeLimitMinutes} ${settings.timeLimitMinutes === 1 ? 'minute' : 'minutes'}`
                : 'No time limit'
              : study
                ? 'Hints and retries'
                : `${settings.quizAttempts} ${settings.quizAttempts === 1 ? 'attempt' : 'attempts'} per question`),
        ]),
        options.description ? h('p', { class: 'knowledge-description' }, options.description) : null,
        h('div', { class: 'knowledge-intro-details' }, [
          h('h4', 'What to expect'),
          h('p', study ? 'Try an answer before checking. Use explanations as hints, reveal an answer when stuck, and retry as often as you like. The Study score is only a running practice statistic.' :
            test ? 'Answer independently. Revisit and change responses before submitting; feedback stays hidden during the Test.' :
              `Check each answer for immediate feedback. You have up to ${settings.quizAttempts} ${settings.quizAttempts === 1 ? 'attempt' : 'attempts'} per question; a correct answer or the final allowed attempt locks it before you move on.`),
          settings.presentation === 'one-at-a-time' && !settings.allowBack && !study
            ? h('p', 'You cannot return to previous questions once you move forward.') : null,
          settings.presentation === 'scroll' && !test
            ? h('p', 'All questions appear in a scrollable list, each with its own question number and Check answer button where applicable.') : null,
          settings.shuffleChoices && !study ? h('p', 'Multiple-choice and dropdown choices will be shuffled for this session.') : null,
          test ? h('p', settings.timeLimitMinutes !== null ? 'The clock starts only when you press Start test. When time runs out, your current answers are submitted.' : 'There is no clock. Submit when you are ready.') : null,
          test ? h('p', settings.showTestAnswers ? 'Results include your score and a review of correct/wrong answers.' : 'This Test shows your score only; answers and explanations remain hidden.') : null,
        ]),
        props.message ? h('p', { role: 'status', class: 'knowledge-message' }, props.message) : null,
        props.ended ? h('p', { role: 'status' }, study ? 'Your study session ended. Start again when ready.' : 'Your previous session ended. Start again when ready.') : null,
        h('div', { class: 'knowledge-intro-actions' }, [
          h('button', { type: 'button', class: 'quiet-button',
            onClick: () => emit('back') }, 'Back'),
          props.resumable ? h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('resume') }, 'Resume saved session') : null,
          h(EntryStatistics, { app: 'knowledge-check', id: props.item.id,
            metric: study ? 'studyPasses' : test ? 'tests' : 'quizzes' }),
          h('button', { type: 'button', class: 'card-primary-button', disabled: !props.count,
            onClick: () => emit('start') }, [
            study ? 'Start studying' : `Start ${mode.label.toLowerCase()}`,
            h(Icon, { name: 'chevron' }),
          ]),
        ]),
        h('p', { class: 'knowledge-muted knowledge-intro-note' },
          study
            ? 'Use Pause Studying to save your current progress on this browser, or End studying to discard it.'
            : !test && settings.timeLimitMinutes === null
              ? 'Use Pause Quiz to save your answers on this browser, or End quiz to discard them.'
              : props.item.questions.some(question => question.type === 'parameterized')
                ? 'Generated questions stay stable during this session; interruption recovery is browser-local. Ending discards saved progress.'
                : 'Leaving or switching modes ends the active Test. Test answers are not preserved after ending.'),
      ]);
    };
  },
});
