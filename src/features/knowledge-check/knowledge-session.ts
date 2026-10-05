import type { CheckItem } from './library-model.ts';
import type { CheckModeId } from './check-types.ts';
import { answerCorrect, type Question } from './question-model.ts';
import { inputValue } from '../../core/dom.ts';
import { SessionIntro } from './session-intro.ts';
import { useKnowledgeSession } from './session-state.ts';
import { defineComponent, h, type PropType } from 'vue';

export const KnowledgeSession = defineComponent({
  name: 'KnowledgeSession',
  props: { item: { type: Object as PropType<CheckItem>, required: true }, mode: { type: String as PropType<CheckModeId>, required: true } },
  emits: { build: () => true },
  setup(props, { emit }) {
    const state = useKnowledgeSession(props.item, props.mode);
    const { questions, options, position, responses, checked, revealed, hints, submitted, started, expired, ended,
      answered, score, remaining, celebrating, start, end, check, submit, tick } = state;
    function response(question: Question, value: string) {
      tick(); if (submitted.value) return;
      responses.value[question.id] = value;
      if (props.mode === 'study') checked.value.delete(question.id);
    }
    function feedback(question: Question, showAnswer = true) {
      const correct = answerCorrect(question, responses.value[question.id] ?? '');
      return h('div', { class: ['knowledge-feedback', correct ? 'is-correct' : 'is-incorrect',
        { 'is-celebrating': celebrating.value === question.id }], role: 'status' }, [
        h('strong', correct ? props.mode === 'test' ? 'Correct' : 'Correct — well done!' :
          props.mode === 'study' ? 'Not quite. Give it another try.' : props.mode === 'test' ? 'Incorrect' : 'Not quite — here’s the answer.'),
        showAnswer ? h('p', `Correct answer: ${question.answer}`) : null,
        showAnswer && question.explanation ? h('p', question.explanation) : null,
        celebrating.value === question.id ? h('span', { class: 'knowledge-success-spark', 'aria-hidden': 'true' }, '✦') : null,
      ]);
    }
    function submitTest() {
      tick(); if (submitted.value) return;
      const unanswered = questions.value.length - answered.value;
      if (unanswered && !window.confirm(`Submit with ${unanswered} unanswered ${unanswered === 1 ? 'question' : 'questions'}? These will count as incorrect.`)) return;
      tick(); if (!submitted.value) submit();
    }
    return () => {
      const question = questions.value[position.value];
      if (!questions.value.length) return h('section', { class: 'knowledge-session knowledge-builder-empty' }, [
        h('h3', 'Add questions to get started'), h('p', 'Complete a question and its correct answer in the builder.'),
        h('button', { type: 'button', class: 'card-primary-button', onClick: () => emit('build') }, 'Build questions'),
      ]);
      if (!started.value) return h(SessionIntro, { item: props.item, mode: props.mode, count: questions.value.length,
        ended: ended.value, onStart: start });
      if (submitted.value) {
        const showAnswers = props.mode !== 'test' || options.value.showTestAnswers;
        return h('section', { class: 'knowledge-session', 'aria-label': 'Results' }, [
          h('header', { class: 'knowledge-results-heading' }, [h('h3', props.mode === 'test' ? 'Test complete' : 'Quiz complete'),
            h('p', { class: 'knowledge-score' }, `${score.value} / ${questions.value.length}`),
            h('p', `${Math.round(score.value / questions.value.length * 100)}% correct`),
            expired.value ? h('p', { role: 'status' }, 'Time ran out. Your entered answers were submitted automatically.') : null]),
          showAnswers ? questions.value.map((entry, index) => h('article', { class: 'knowledge-result', key: entry.id }, [
            h('h4', `${index + 1}. ${entry.prompt}`), h('p', `Your answer: ${responses.value[entry.id] || 'No answer'}`), feedback(entry),
          ])) : h('p', 'This set is configured to show the score only.'),
          h('button', { type: 'button', class: 'card-primary-button', onClick: () => { started.value = false; } }, 'Back to overview'),
        ]);
      }
      if (!question) return null;
      const study = props.mode === 'study';
      const wasChecked = checked.value.has(question.id);
      const locked = props.mode === 'quiz' && wasChecked;
      const correct = answerCorrect(question, responses.value[question.id] ?? '');
      const choices = question.type === 'true-false' ? ['True', 'False'] : question.choices.filter(choice => choice.trim());
      return h('section', { class: 'knowledge-session', 'data-mode': props.mode, 'aria-label': `${props.mode} questions` }, [
        h('div', { class: 'knowledge-session-progress' }, [h('p', `Question ${position.value + 1} of ${questions.value.length}`),
          study ? h('p', 'Practice freely — hints and retries welcome') : h('p', `${answered.value} answered`),
          remaining.value !== null ? h('p', { class: ['knowledge-timer', { 'is-low': remaining.value <= 60 }], role: 'timer', 'aria-live': 'off' },
            `Time left: ${Math.floor(remaining.value / 60)}:${String(remaining.value % 60).padStart(2, '0')}`) : null,
          study ? h('button', { type: 'button', class: 'quiet-button', onClick: end }, 'End studying') :
            h('button', { type: 'button', class: 'quiet-button', onClick: state.leave }, props.mode === 'test' ? 'End test' : 'End quiz')]),
        questions.value.length < props.item.questions.length ? h('p', { class: 'knowledge-muted' }, 'This older set contains unfinished questions. Complete them in the builder to include them.') : null,
        h('article', { class: 'knowledge-prompt', key: question.id }, [
          h('h3', question.prompt),
          question.type === 'short-answer' ? h('label', { class: 'knowledge-field' }, ['Your answer', h('textarea', {
            rows: 3, value: responses.value[question.id] ?? '', readonly: locked, maxlength: 2000,
            onInput: (event: Event) => response(question, inputValue(event)),
          })]) : h('fieldset', { class: 'knowledge-answer-choices', disabled: locked }, [h('legend', 'Your answer'),
            ...choices.map((choice, index) => h('label', { class: ['knowledge-answer-choice', { 'is-selected': responses.value[question.id] === choice }], key: index }, [
              h('input', { type: 'radio', name: `response-${question.id}`, checked: responses.value[question.id] === choice,
                onChange: () => response(question, choice) }), h('span', choice),
            ]))]),
          props.mode !== 'test' ? h('div', {}, [
            wasChecked ? feedback(question, !study || correct) : null,
            !locked ? h('button', { type: 'button', class: 'card-primary-button',
              disabled: !responses.value[question.id]?.trim(), onClick: check }, 'Check answer') : null,
          ]) : h('p', { class: 'knowledge-muted' }, 'Feedback is held until submission. You can change your answers.'),
          study ? h('div', { class: 'knowledge-study-tools' }, [
            question.explanation ? h('button', { type: 'button', class: 'quiet-button', onClick: () => {
              if (hints.value.has(question.id)) hints.value.delete(question.id); else hints.value.add(question.id);
            } }, hints.value.has(question.id) ? 'Hide explanation' : 'Use explanation as a hint') : null,
            hints.value.has(question.id) ? h('p', { class: 'knowledge-study-answer' }, question.explanation) : null,
            h('button', { type: 'button', class: 'quiet-button', onClick: () => {
              if (revealed.value.has(question.id)) revealed.value.delete(question.id); else revealed.value.add(question.id);
            } }, revealed.value.has(question.id) ? 'Hide answer' : 'Show answer'),
            revealed.value.has(question.id) ? h('div', { class: 'knowledge-study-answer' }, [
              h('p', `Answer: ${question.answer}`),
            ]) : null,
          ]) : null,
        ]),
        h('div', { class: 'knowledge-session-navigation' }, [
          h('button', { type: 'button', class: 'quiet-button', disabled: position.value === 0,
            onClick: () => { tick(); if (!submitted.value) position.value -= 1; } }, 'Previous'),
          position.value < questions.value.length - 1 ? h('button', { type: 'button', class: 'card-primary-button',
            disabled: props.mode === 'quiz' && !wasChecked,
            onClick: () => { tick(); if (!submitted.value) position.value += 1; } }, 'Next question') :
            !study ? h('button', { type: 'button', class: 'card-primary-button',
              disabled: props.mode === 'quiz' && checked.value.size !== questions.value.length,
              onClick: props.mode === 'test' ? submitTest : () => submit() }, props.mode === 'test' ? 'Submit test' : 'See results') :
              h('button', { type: 'button', class: 'quiet-button', onClick: () => { position.value = 0; } }, 'Back to first question'),
        ]),
      ]);
    };
  },
});
