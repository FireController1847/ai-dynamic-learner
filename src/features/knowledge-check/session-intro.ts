import { defineComponent, h, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { CHECK_MODES, type CheckModeId } from './check-types.ts';
import type { CheckItem } from './library-model.ts';
import { defaultSetOptions } from './set-options.ts';

export const SessionIntro = defineComponent({
  name: 'KnowledgeSessionIntro',
  props: { item: { type: Object as PropType<CheckItem>, required: true },
    mode: { type: String as PropType<CheckModeId>, required: true }, count: { type: Number, required: true }, ended: Boolean },
  emits: { start: () => true },
  setup(props, { emit }) {
    return () => {
      const test = props.mode === 'test';
      const study = props.mode === 'study';
      const mode = CHECK_MODES.find(entry => entry.id === props.mode)!;
      const options = props.item.options ?? defaultSetOptions();
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
          pill('clock', test && options.timeLimitMinutes !== null ?
            `${options.timeLimitMinutes} ${options.timeLimitMinutes === 1 ? 'minute' : 'minutes'}` : 'No time limit'),
          pill(test ? 'verified' : 'check', study ? 'Hints and retries' : test ? 'Feedback at the end' : 'Instant feedback'),
        ]),
        options.description ? h('p', { class: 'knowledge-description' }, options.description) : null,
        h('div', { class: 'knowledge-intro-details' }, [
          h('h4', 'What to expect'),
          h('p', study ? 'Try an answer before checking. Use explanations as hints, reveal an answer when stuck, and retry as often as you like. No score or pressure.' :
            test ? 'Answer independently. Revisit and change responses before submitting; feedback stays hidden during the Test.' :
              'Check each answer for immediate feedback and an explanation. Checked responses are locked, so you can focus on what to learn before moving on.'),
          test ? h('p', options.timeLimitMinutes !== null ? 'The clock starts only when you press Start test. When time runs out, your current answers are submitted.' : 'There is no clock. Submit when you are ready.') : null,
          test ? h('p', options.showTestAnswers ? 'Results include your score and a review of correct/wrong answers.' : 'This Test shows your score only; answers and explanations remain hidden.') : null,
        ]),
        props.ended ? h('p', { role: 'status' }, study ? 'Your study session ended. Start again when ready.' : 'Your previous session ended. Start again when ready.') : null,
        h('div', { class: 'knowledge-intro-actions' }, [
          h('button', { type: 'button', class: 'card-primary-button', disabled: !props.count,
            onClick: () => emit('start') }, [
            study ? 'Start studying' : `Start ${mode.label.toLowerCase()}`,
            h(Icon, { name: 'chevron' }),
          ]),
        ]),
        h('p', { class: 'knowledge-muted knowledge-intro-note' }, study ?
          'Press End studying whenever you are ready. Starting again begins a fresh practice session.' :
          'Leaving this set or switching modes will end an active session. Answers are not saved between sessions.'),
      ]);
    };
  },
});
