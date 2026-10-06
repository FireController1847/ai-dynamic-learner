import { isFillBlankAnswerCorrect, maskFillBlankAnswers, parseFillBlankTemplate } from '../../core/fill-blank.ts';
import type { CheckItem } from './library-model.ts';
import type { CheckModeId } from './check-types.ts';
import { answerCorrect, fillBlankCorrectCount, questionResponseAnswered, type Question, type QuestionResponse } from './question-model.ts';
import { inputValue } from '../../core/dom.ts';
import { SessionIntro } from './session-intro.ts';
import { useKnowledgeSession } from './session-state.ts';
import { defineComponent, h, ref, type PropType } from 'vue';

export const KnowledgeSession = defineComponent({
  name: 'KnowledgeSession',
  props: { item: { type: Object as PropType<CheckItem>, required: true }, mode: { type: String as PropType<CheckModeId>, required: true } },
  emits: { back: () => true, build: () => true },
  setup(props, { emit }) {
    const state = useKnowledgeSession(props.item, props.mode);
    const { questions, options, position, responses, checked, revealed, hints, submitted, started, expired, ended,
      answered, score, remaining, celebrating, attempts, studyChecks, studyCorrectChecks,
      start, end, check, submit, tick } = state;
    const fillBlankPrimaryButton = ref<HTMLButtonElement | null>(null);

    function currentResponse(question: Question): QuestionResponse {
      return responses.value[question.id] ?? (question.type === 'fill-in-the-blanks' ? [] : '');
    }

    function textResponse(question: Question): string {
      const value = currentResponse(question);
      return typeof value === 'string' ? value : '';
    }

    function blankResponses(question: Question): string[] {
      const value = currentResponse(question);
      return Array.isArray(value) ? value : [];
    }

    function response(question: Question, value: string) {
      tick(); if (submitted.value) return;
      responses.value[question.id] = value;
      if (props.mode === 'study') checked.value.delete(question.id);
    }

    function blankResponse(question: Question, index: number, value: string) {
      tick(); if (submitted.value) return;
      const next = [...blankResponses(question)];
      next[index] = value;
      responses.value[question.id] = next;
      if (props.mode === 'study') checked.value.delete(question.id);
    }

    function fillBlankAnswerKey(question: Question) {
      const answers = parseFillBlankTemplate(question.prompt).answers;
      return h('ol', { class: 'knowledge-fill-blank-feedback-list' },
        answers.map((answer, index) => h('li', { key: `${index}-${answer}` }, [
          h('strong', `Blank ${index + 1}:`), ' ', answer,
        ])));
    }

    function feedback(question: Question, showAnswer = true) {
      const submittedResponse = currentResponse(question);
      const correct = answerCorrect(question, submittedResponse);
      const attemptCount = attempts.value[question.id] ?? 0;
      const quizRetry = props.mode === 'quiz' && !correct && !checked.value.has(question.id) && attemptCount > 0;
      const attemptsRemaining = Math.max(0, options.value.quizAttempts - attemptCount);
      const content = [
        h('strong', correct ? props.mode === 'test' ? 'Correct' : 'Correct — well done!' :
          props.mode === 'study' ? 'Not quite. Give it another try.' :
            props.mode === 'test' ? 'Incorrect' :
              quizRetry ? `Not quite — ${attemptsRemaining} ${attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining.` :
                'Not quite — here’s the answer.'),
      ];

      if (question.type === 'fill-in-the-blanks') {
        const template = parseFillBlankTemplate(question.prompt);
        const values = blankResponses(question);
        const correctCount = fillBlankCorrectCount(question, values);
        content.push(h('p', `${correctCount} of ${template.answers.length} ${template.answers.length === 1 ? 'blank' : 'blanks'} correct.`));
        content.push(h('ol', { class: 'knowledge-fill-blank-feedback-list' }, template.answers.map((answer, index) => {
          const value = values[index] ?? '';
          const blankCorrect = isFillBlankAnswerCorrect(answer, value);
          return h('li', { key: `${index}-${answer}`, class: blankCorrect ? 'is-correct' : 'is-incorrect' }, [
            h('strong', `Blank ${index + 1}: ${blankCorrect ? 'Correct' : 'Incorrect'}`),
            showAnswer ? h('span', {}, [
              h('span', { class: 'knowledge-fill-blank-feedback-answer' }, `Correct answer: ${answer}`),
              !blankCorrect ? h('span', { class: 'knowledge-fill-blank-feedback-response' }, `Your answer: ${value || 'No answer'}`) : null,
            ]) : null,
          ]);
        })));
      } else if (showAnswer) {
        content.push(h('p', `Correct answer: ${question.answer}`));
      }

      if (showAnswer && question.explanation) content.push(h('p', question.explanation));
      if (celebrating.value === question.id) {
        content.push(h('span', { class: 'knowledge-success-spark', 'aria-hidden': 'true' }, '✦'));
      }
      return h('div', { class: ['knowledge-feedback', correct ? 'is-correct' : 'is-incorrect',
        { 'is-celebrating': celebrating.value === question.id }], role: 'status' }, content);
    }

    function handleFillBlankEnter(event: KeyboardEvent, blankIndex: number, blankCount: number, locked: boolean) {
      if (locked || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.key !== 'Enter') return;
      event.preventDefault();

      const prompt = (event.currentTarget as HTMLElement).closest('.knowledge-fill-blank-prompt');
      const inputs = prompt ? [...prompt.querySelectorAll<HTMLInputElement>('input.knowledge-fill-blank-input')] : [];
      if (event.shiftKey) {
        inputs[Math.max(0, blankIndex - 1)]?.focus();
      } else if (blankIndex < blankCount - 1) {
        inputs[blankIndex + 1]?.focus();
      } else {
        fillBlankPrimaryButton.value?.click();
      }
    }

    function fillBlankPrompt(question: Question, locked: boolean) {
      const template = parseFillBlankTemplate(question.prompt);
      const values = blankResponses(question);
      return h('div', {
        class: 'knowledge-fill-blank-prompt',
        'aria-label': `Fill in ${template.answers.length} ${template.answers.length === 1 ? 'blank' : 'blanks'}`,
      }, template.segments.map((segment) => {
        if (segment.type === 'text') return h('span', { class: 'knowledge-fill-blank-text' }, segment.text);
        const value = values[segment.index] ?? '';
        return h('span', { class: 'knowledge-fill-blank-response', key: `blank-${segment.index}` }, [
          h('sub', { class: 'knowledge-fill-blank-number', 'aria-hidden': 'true' }, String(segment.index + 1)),
          h('input', {
            class: 'knowledge-fill-blank-input',
            type: 'text',
            value,
            readonly: locked,
            autocomplete: 'off',
            spellcheck: false,
            maxlength: 2000,
            style: { '--blank-width': `${Math.max(6, Math.min(28, value.length + 1))}ch` },
            'aria-label': `Blank ${segment.index + 1} of ${template.answers.length}`,
            onInput: (event: Event) => blankResponse(question, segment.index, inputValue(event)),
            onKeydown: (event: KeyboardEvent) =>
              handleFillBlankEnter(event, segment.index, template.answers.length, locked),
          }),
        ]);
      }));
    }

    function responseSummary(question: Question) {
      const value = currentResponse(question);
      if (!Array.isArray(value)) return h('p', `Your answer: ${value || 'No answer'}`);
      const answers = parseFillBlankTemplate(question.prompt).answers;
      return h('div', { class: 'knowledge-fill-blank-result-responses' }, [
        h('p', 'Your answers:'),
        h('ol', answers.map((_answer, index) => h('li', { key: index }, value[index] || 'No answer'))),
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
        ended: ended.value, onBack: () => emit('back'), onStart: start });
      if (submitted.value) {
        const showAnswers = props.mode !== 'test' || options.value.showTestAnswers;
        return h('section', { class: 'knowledge-session', 'aria-label': 'Results' }, [
          h('header', { class: 'knowledge-results-heading' }, [h('h3', props.mode === 'test' ? 'Test complete' : 'Quiz complete'),
            h('p', { class: 'knowledge-score' }, `${score.value} / ${questions.value.length}`),
            h('p', `${Math.round(score.value / questions.value.length * 100)}% correct`),
            expired.value ? h('p', { role: 'status' }, 'Time ran out. Your entered answers were submitted automatically.') : null]),
          showAnswers ? questions.value.map((entry, index) => h('article', { class: 'knowledge-result', key: entry.id }, [
            h('h4', `${index + 1}. ${entry.type === 'fill-in-the-blanks' ? maskFillBlankAnswers(entry.prompt) : entry.prompt}`),
            responseSummary(entry),
            feedback(entry),
          ])) : h('p', 'This set is configured to show the score only.'),
          h('button', { type: 'button', class: 'card-primary-button', onClick: () => { started.value = false; } }, 'Back to overview'),
        ]);
      }
      if (!question) return null;
      const study = props.mode === 'study';
      const wasChecked = checked.value.has(question.id);
      const attemptCount = attempts.value[question.id] ?? 0;
      const quizRetrying = props.mode === 'quiz' && attemptCount > 0 && !wasChecked;
      const showFeedback = wasChecked || quizRetrying;
      const locked = props.mode === 'quiz' && wasChecked;
      const correct = answerCorrect(question, currentResponse(question));
      const choices = question.type === 'true-false' ? ['True', 'False'] : question.choices.filter(choice => choice.trim());
      const canCheck = question.type === 'fill-in-the-blanks' || questionResponseAnswered(question, currentResponse(question));

      return h('section', { class: 'knowledge-session', 'data-mode': props.mode, 'aria-label': `${props.mode} questions` }, [
        h('div', { class: 'knowledge-session-progress' }, [h('p', `Question ${position.value + 1} of ${questions.value.length}`),
          study ? h('p', 'Practice freely — hints and retries welcome') : h('p', `${answered.value} answered`),
          study ? h('details', { class: 'knowledge-study-score' }, [
            h('summary', 'Study score'),
            h('span', studyChecks.value
              ? `${studyCorrectChecks.value} / ${studyChecks.value} checks correct · ${Math.round(studyCorrectChecks.value / studyChecks.value * 100)}%`
              : 'No answers checked yet.'),
          ]) : null,
          remaining.value !== null ? h('p', { class: ['knowledge-timer', { 'is-low': remaining.value <= 60 }], role: 'timer', 'aria-live': 'off' },
            `Time left: ${Math.floor(remaining.value / 60)}:${String(remaining.value % 60).padStart(2, '0')}`) : null,
          study ? h('button', { type: 'button', class: 'quiet-button', onClick: end }, 'End studying') :
            h('button', { type: 'button', class: 'quiet-button', onClick: state.leave }, props.mode === 'test' ? 'End test' : 'End quiz')]),
        questions.value.length < props.item.questions.length ? h('p', { class: 'knowledge-muted' }, 'This older set contains unfinished questions. Complete them in the builder to include them.') : null,
        h('article', { class: 'knowledge-prompt', key: question.id }, [
          question.type === 'fill-in-the-blanks'
            ? fillBlankPrompt(question, locked)
            : h('h3', question.prompt),
          question.type === 'fill-in-the-blanks' ? null
            : question.type === 'short-answer' ? h('label', { class: 'knowledge-field' }, ['Your answer', h('textarea', {
              rows: 3, value: textResponse(question), readonly: locked, maxlength: 2000,
              onInput: (event: Event) => response(question, inputValue(event)),
            })]) : h('fieldset', { class: 'knowledge-answer-choices', disabled: locked }, [h('legend', 'Your answer'),
              ...choices.map((choice, index) => h('label', { class: ['knowledge-answer-choice', { 'is-selected': textResponse(question) === choice }], key: index }, [
                h('input', { type: 'radio', name: `response-${question.id}`, checked: textResponse(question) === choice,
                  onChange: () => response(question, choice) }), h('span', choice),
              ]))]),
          props.mode !== 'test' ? h('div', {}, [
            showFeedback ? feedback(question, study ? correct : !quizRetrying) : null,
            !locked ? h('button', {
              ref: question.type === 'fill-in-the-blanks' ? fillBlankPrimaryButton : undefined,
              type: 'button', class: 'card-primary-button',
              disabled: !canCheck, onClick: check,
            }, 'Check answer') : null,
          ]) : h('p', { class: 'knowledge-muted' }, 'Feedback is held until submission. You can change your answers.'),
          study ? h('div', { class: 'knowledge-study-tools' }, [
            question.explanation ? h('button', { type: 'button', class: 'quiet-button', onClick: () => {
              if (hints.value.has(question.id)) hints.value.delete(question.id); else hints.value.add(question.id);
            } }, hints.value.has(question.id) ? 'Hide explanation' : 'Use explanation as a hint') : null,
            hints.value.has(question.id) ? h('p', { class: 'knowledge-study-answer' }, question.explanation) : null,
            h('button', { type: 'button', class: 'quiet-button', onClick: () => {
              if (revealed.value.has(question.id)) revealed.value.delete(question.id); else revealed.value.add(question.id);
            } }, revealed.value.has(question.id) ? 'Hide answer' : 'Show answer'),
            revealed.value.has(question.id) ? h('div', { class: 'knowledge-study-answer' },
              question.type === 'fill-in-the-blanks' ? [h('p', 'Answers:'), fillBlankAnswerKey(question)] : [h('p', `Answer: ${question.answer}`)]) : null,
          ]) : null,
        ]),
        h('div', { class: 'knowledge-session-navigation' }, [
          h('button', { type: 'button', class: 'quiet-button', disabled: position.value === 0,
            onClick: () => { tick(); if (!submitted.value) position.value -= 1; } }, 'Previous'),
          position.value < questions.value.length - 1 ? h('button', {
            ref: question.type === 'fill-in-the-blanks' && props.mode === 'test' ? fillBlankPrimaryButton : undefined,
            type: 'button', class: 'card-primary-button',
            disabled: props.mode === 'quiz' && !wasChecked,
            onClick: () => { tick(); if (!submitted.value) position.value += 1; },
          }, 'Next question') :
            !study ? h('button', {
              ref: question.type === 'fill-in-the-blanks' && props.mode === 'test' ? fillBlankPrimaryButton : undefined,
              type: 'button', class: 'card-primary-button',
              disabled: props.mode === 'quiz' && checked.value.size !== questions.value.length,
              onClick: props.mode === 'test' ? submitTest : () => submit(),
            }, props.mode === 'test' ? 'Submit test' : 'See results') :
              h('button', { type: 'button', class: 'quiet-button', onClick: () => { position.value = 0; } }, 'Back to first question'),
        ]),
      ]);
    };
  },
});
