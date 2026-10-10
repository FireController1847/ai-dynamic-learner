import { generatedAnswerCorrect } from '../../core/parameterized/answers.ts';
import { useStudySession } from '../../components/use-study-session.ts';
import { maskFillBlankAnswers, parseFillBlankTemplate } from '../../core/fill-blank.ts';
import type { CheckItem } from './library-model.ts';
import type { CheckModeId } from './check-types.ts';
import { answerCorrect, fillBlankCorrectness, questionResponseAnswered, questionScored, type Question, type QuestionResponse } from './question-model.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { MarkdownContent } from '../../components/markdown-content.ts';
import { SessionIntro } from './session-intro.ts';
import { answerStrictnessForQuestion } from './session-settings.ts';
import { useKnowledgeSession } from './session-state.ts';
import { dropdownCorrectness } from './dropdown-model.ts';
import { enterReviewPanel, leaveReviewPanel, restoreReviewPanel } from './review-motion.ts';
import { computed, defineComponent, h, ref, Transition, type PropType } from 'vue';

export const KnowledgeSession = defineComponent({
  name: 'KnowledgeSession',
  props: {
    item: { type: Object as PropType<CheckItem>, required: true },
    mode: { type: String as PropType<CheckModeId>, required: true },
    settings: { type: Object as PropType<import('./session-settings.ts').SessionSettings>, required: true },
    statisticsEnabled: { type: Boolean, default: true },
  },
  emits: { back: () => true, build: () => true },
  setup(props, { emit }) {
    const state = useKnowledgeSession(props.item, props.mode, props.settings, props.statisticsEnabled);
    const { questions, questionCount, options, position, responses, feedbackResponses, checked, revealed, hints, submitted, started, expired, ended,
      answered, resolved, score, scoredCount, remaining, celebrating, attempts, studyChecks, studyCorrectChecks,
      start, end, check, submit, tick } = state;
    useStudySession(computed(() => started.value && !submitted.value && !ended.value));
    const fillBlankPrimaryButton = ref<HTMLButtonElement | null>(null);
    const backward = ref(false);

    function moveQuestion(next: number, wrap = false) {
      tick();
      if (submitted.value || state.generating.value || state.submitting.value || next < 0 || next >= questions.value.length) return;
      if (wrap) state.finishStudyPass();
      backward.value = next < position.value && !wrap;
      position.value = next;
      if (wrap) state.resetStudyPass();
    }

    function reveal(id: string, content: ReturnType<typeof h> | null) {
      return h(Transition, { name: 'knowledge-reveal', onBeforeLeave: leaveReviewPanel, onLeaveCancelled: restoreReviewPanel }, {
        default: () => content ? h('div', { key: id, class: 'knowledge-reveal' }, [
          h('div', { class: 'knowledge-reveal-inner' }, [content]),
        ]) : null,
      });
    }

    function currentResponse(question: Question): QuestionResponse {
      return responses.value[question.id] ?? (question.type === 'fill-in-the-blanks' || question.type === 'dropdown' || question.type === 'parameterized' ? [] : '');
    }

    function textResponse(question: Question): string {
      const value = currentResponse(question);
      return typeof value === 'string' ? value : '';
    }

    function blankResponses(question: Question): string[] {
      const value = currentResponse(question);
      return Array.isArray(value) ? value : [];
    }

    function feedbackResponse(question: Question): QuestionResponse {
      return props.mode === 'quiz' && !checked.value.has(question.id)
        ? feedbackResponses.value[question.id] ?? currentResponse(question) : currentResponse(question);
    }

    function response(question: Question, value: string) {
      tick(); if (submitted.value || state.submitting.value || state.generating.value) return;
      responses.value[question.id] = value;
      if (props.mode === 'study') checked.value.delete(question.id);
    }

    function blankResponse(question: Question, index: number, value: string) {
      tick(); if (submitted.value || state.submitting.value || state.generating.value) return;
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
      const submittedResponse = feedbackResponse(question);
      const correct = answerCorrect(
        question,
        submittedResponse,
        answerStrictnessForQuestion(options.value, question.type),
      );
      const attemptCount = attempts.value[question.id] ?? 0;
      const quizRetry = props.mode === 'quiz' && !correct && !checked.value.has(question.id) && attemptCount > 0;
      const attemptsRemaining = Math.max(0, options.value.quizAttempts - attemptCount);
      const content = [
        h('strong', correct ? props.mode === 'test' ? 'Correct' : 'Correct — well done!' :
          props.mode === 'study' ? 'Not quite. Give it another try.' :
            props.mode === 'test' ? 'Incorrect' :
              quizRetry ? `Not quite — ${attemptsRemaining} ${attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining.` :
                question.type === 'multiple-choice' ? 'Not quite.' : 'Not quite — here’s the answer.'),
      ];

      if (question.type === 'parameterized') {
        const values = Array.isArray(submittedResponse) ? submittedResponse : [];
        content.push(h('ol', { class: 'knowledge-fill-blank-feedback-list' }, (question.generated?.answers ?? []).map((answer, index) => h('li', { key: answer.key }, [
          h('strong', `${answer.label}: ${generatedAnswerCorrect(answer, values[index] ?? '') ? 'Correct' : 'Incorrect'}`),
          showAnswer ? ` · Correct answer: ${answer.text}` : null,
        ]))));
      } else if (question.type === 'dropdown') {
        const rows = question.matches ?? [];
        const correctness = dropdownCorrectness(rows, submittedResponse);
        content.push(h('p', `${correctness.filter(Boolean).length} of ${rows.length} matches correct.`));
        content.push(h('ol', { class: 'knowledge-fill-blank-feedback-list' }, rows.map((row, index) => h('li', {
          key: index, class: correctness[index] ? 'is-correct' : 'is-incorrect',
        }, [h('strong', `${row.label}: ${correctness[index] ? 'Correct' : 'Incorrect'}`),
          showAnswer ? h('span', { class: 'knowledge-fill-blank-feedback-answer' }, `Correct answer: ${row.answer}`) : null]))));
      } else if (question.type === 'fill-in-the-blanks') {
        const template = parseFillBlankTemplate(question.prompt);
        const values = Array.isArray(submittedResponse) ? submittedResponse : [];
        const correctness = fillBlankCorrectness(
          question,
          values,
          options.value.fillBlankAnswerStrictness,
        );
        const correctCount = correctness.filter(Boolean).length;
        content.push(h('p', `${correctCount} of ${template.answers.length} ${template.answers.length === 1 ? 'blank' : 'blanks'} correct.`));
        content.push(h('ol', { class: 'knowledge-fill-blank-feedback-list' }, template.answers.map((answer, index) => {
          const value = values[index] ?? '';
          const blankCorrect = correctness[index] ?? false;
          return h('li', { key: `${index}-${answer}`, class: blankCorrect ? 'is-correct' : 'is-incorrect' }, [
            h('strong', `Blank ${index + 1}: ${blankCorrect ? 'Correct' : 'Incorrect'}`),
            showAnswer ? h('span', {}, [
              h('span', { class: 'knowledge-fill-blank-feedback-answer' }, `Correct answer: ${answer}`),
              !blankCorrect ? h('span', { class: 'knowledge-fill-blank-feedback-response' }, `Your answer: ${value || 'No answer'}`) : null,
            ]) : null,
          ]);
        })));
      } else if (showAnswer && question.type !== 'multiple-choice') {
        content.push(h('p', `Correct answer: ${question.answer}`));
      }

      if (showAnswer && question.explanation) content.push(h('p', question.explanation));
      if (showAnswer && question.generated?.trace.length) content.push(h('details', [h('summary', 'Calculation trace'),
        h('ol', question.generated.trace.map(line => h('li', line))),
      ]));
      if (celebrating.value === question.id) {
        content.push(...[0, 1, 2].map(index => h('span', {
          class: 'knowledge-success-spark', 'aria-hidden': 'true',
          style: { right: `${14 + index * 16}px`, animationDelay: `${index * 55}ms` },
        }, index === 1 ? '✧' : '✦')));
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

    function fillBlankPrompt(question: Question, locked: boolean, showFeedback: boolean) {
      const template = parseFillBlankTemplate(question.prompt);
      const values = blankResponses(question);
      const correctness = showFeedback ? fillBlankCorrectness(question, feedbackResponse(question), options.value.fillBlankAnswerStrictness) : [];
      return h('div', {
        class: 'knowledge-fill-blank-prompt',
        'aria-label': `Fill in ${template.answers.length} ${template.answers.length === 1 ? 'blank' : 'blanks'}`,
      }, template.segments.map((segment) => {
        if (segment.type === 'text') return h('span', { class: 'knowledge-fill-blank-text' }, segment.text);
        const value = values[segment.index] ?? '';
        return h('span', { class: 'knowledge-fill-blank-response', key: `blank-${segment.index}` }, [
          h('sub', { class: 'knowledge-fill-blank-number', 'aria-hidden': 'true' }, String(segment.index + 1)),
          h('input', {
            class: ['knowledge-fill-blank-input', {
              'is-correct': showFeedback && correctness[segment.index],
              'is-incorrect': showFeedback && !correctness[segment.index],
            }],
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
      if (!questionScored(question)) return null;
      const value = currentResponse(question);
      if (!Array.isArray(value)) return h('p', `Your answer: ${value || 'No answer'}`);
      const answers = question.type === 'parameterized' ? (question.generated?.answers ?? []).map(answer => answer.label) : question.type === 'dropdown' ? (question.matches ?? []).map(row => row.label) : parseFillBlankTemplate(question.prompt).answers;
      return h('div', { class: 'knowledge-fill-blank-result-responses' }, [
        h('p', 'Your answers:'),
        h('ol', answers.map((answer, index) => h('li', { key: index }, `${['dropdown','parameterized'].includes(question.type) ? answer + ': ' : ''}${value[index] || 'No answer'}`))),
      ]);
    }

    function submitTest() {
      tick(); if (submitted.value || state.submitting.value || state.generating.value) return;
      const unanswered = scoredCount.value - answered.value;
      if (unanswered && !window.confirm(`Submit with ${unanswered} unanswered ${unanswered === 1 ? 'question' : 'questions'}? These will count as incorrect.`)) return;
      tick(); if (!submitted.value) submit();
    }

    function renderSession() {
      if (state.generating.value || state.submitting.value) return h('section', { key: 'generating', class: 'knowledge-session', 'aria-busy': 'true' }, [
        h('p', { role: 'status' }, state.submitting.value ? 'Preparing results…' : 'Generating your question…'),
        h('button', { type: 'button', class: 'quiet-button', onClick: end }, 'End session'),
      ]);
      if (state.generationError.value) return h('section', { key: 'generation-error', class: 'knowledge-session' }, [
        h('h3', 'This question could not be generated'), h('p', { role: 'alert' }, state.generationError.value),
        h('p', 'Check its ranges, constraints, computed choices, or registered solver in the builder.'),
        h('button', { type: 'button', class: 'quiet-button', onClick: end }, 'Back to overview'),
      ]);
      if (!questionCount.value && !state.resumable.value) return h('section', { key: 'empty', class: 'knowledge-session knowledge-builder-empty' }, [
        h('h3', 'Add questions to get started'), h('p', 'Complete a question and its correct answer in the builder.'),
        h('button', { type: 'button', class: 'card-primary-button', onClick: () => emit('build') }, 'Build questions'),
      ]);
      if (!started.value) return h(SessionIntro, { key: 'intro', item: props.item, mode: props.mode, settings: props.settings,
        count: questionCount.value, ended: ended.value, resumable: state.resumable.value, message: state.storageMessage.value,
        onResume: state.resume, onBack: () => emit('back'), onStart: start });
      const question = questions.value[position.value];
      if (submitted.value) {
        const showAnswers = props.mode !== 'test' || options.value.showTestAnswers;
        return h('section', { key: 'results', class: 'knowledge-session knowledge-session-results', 'aria-label': 'Results' }, [
          h('header', { class: 'knowledge-results-heading' }, [h('h3', props.mode === 'test' ? 'Test complete' : 'Quiz complete'),
            scoredCount.value
              ? h('p', { class: 'knowledge-score' }, `${score.value} / ${scoredCount.value}`)
              : h('p', { class: 'knowledge-score' }, 'No scored questions'),
            scoredCount.value ? h('p', `${Math.round(score.value / scoredCount.value * 100)}% correct`) : null,
            expired.value ? h('p', { role: 'status' }, 'Time ran out. Your entered answers were submitted automatically.') : null]),
          showAnswers ? questions.value.map((entry, index) => h('article', { class: 'knowledge-result', key: entry.id,
            style: { '--review-delay': `${Math.min(index, 8) * 42 + 100}ms` } }, [
            h('h4', `${index + 1}. ${entry.type === 'fill-in-the-blanks' ? maskFillBlankAnswers(entry.prompt) : entry.prompt}`),
            entry.context?.trim() ? h(MarkdownContent, { text: entry.context, class: 'knowledge-question-context' }) : null,
            questionScored(entry) ? [responseSummary(entry), feedback(entry)] :
              h('p', { class: 'knowledge-muted' }, 'Statement · Not scored'),
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
      const scored = questionScored(question);
      const correct = scored && answerCorrect(
        question,
        currentResponse(question),
        answerStrictnessForQuestion(options.value, question.type),
      );
      const choices = question.type === 'true-false' ? ['True', 'False'] : question.choices.filter(choice => choice.trim());
      const canCheck = scored && (question.type === 'fill-in-the-blanks' || questionResponseAnswered(question, currentResponse(question)));

      return h('section', { key: 'questions', class: ['knowledge-session', { 'is-backward': backward.value }], 'data-mode': props.mode, 'aria-label': `${props.mode} questions` }, [
        state.storageMessage.value ? h('p', { role: 'status', class: 'knowledge-message' }, state.storageMessage.value) : null,
        h('div', { class: 'knowledge-session-progress' }, [h('p', `Question ${position.value + 1} of ${questions.value.length}`),
          study ? h('p', 'Practice freely — hints and retries welcome') : h('p', `${answered.value} answered`),
          study ? h('p', { class: 'knowledge-study-score', key: studyChecks.value },
            `${studyCorrectChecks.value} / ${studyChecks.value} checks correct · ${studyChecks.value ? Math.round(studyCorrectChecks.value / studyChecks.value * 100) : 0}%`) : null,
          remaining.value !== null ? h('p', { class: ['knowledge-timer', { 'is-low': remaining.value <= 60 }], role: 'timer', 'aria-live': 'off' },
            `Time left: ${Math.floor(remaining.value / 60)}:${String(remaining.value % 60).padStart(2, '0')}`) : null,
          study ? h('button', { type: 'button', class: 'quiet-button', onClick: end }, 'End studying') :
            h('button', { type: 'button', class: 'quiet-button', onClick: state.leave }, props.mode === 'test' ? 'End test' : 'End quiz'),
          h('div', { class: 'knowledge-progress-track', 'aria-hidden': 'true' }, [
            h('span', { style: { width: `${(position.value + 1) / questions.value.length * 100}%` } }),
          ])]),
        questions.value.length < props.item.questions.length ? h('p', { class: 'knowledge-muted' }, 'This older set contains unfinished questions. Complete them in the builder to include them.') : null,
        h(Transition, { name: 'knowledge-question', mode: 'out-in', onBeforeLeave: leaveReviewPanel,
          onLeaveCancelled: restoreReviewPanel, onAfterEnter: enterReviewPanel }, {
          default: () => h('article', { class: 'knowledge-prompt', key: question.id, tabindex: -1,
            'data-review-focus': '',
            'aria-label': `Question ${position.value + 1} of ${questions.value.length}` }, [
          question.type === 'fill-in-the-blanks' && question.context?.trim()
            ? h(MarkdownContent, { text: question.context, class: 'knowledge-question-context' }) : null,
          question.type === 'fill-in-the-blanks'
            ? fillBlankPrompt(question, locked, showFeedback)
            : h('h3', question.prompt),
          question.type !== 'fill-in-the-blanks' && question.context?.trim()
            ? h(MarkdownContent, { text: question.context, class: 'knowledge-question-context' }) : null,
          question.type === 'parameterized' ? h('div', { class: 'knowledge-parameterized-answers' }, (question.generated?.answers ?? []).map((answer, index) => h('label', { class: 'knowledge-field', key: answer.key }, [
            answer.label, h('input', { type: 'text', inputmode: answer.matching === 'numeric' ? 'decimal' : undefined,
              value: blankResponses(question)[index] ?? '', readonly: locked, autocomplete: 'off', maxlength: 2000,
              onInput: (event: Event) => blankResponse(question, index, inputValue(event)),
            }),
          ]))) : null,
          question.type === 'parameterized' ? null : question.type === 'statement' ? null : question.type === 'fill-in-the-blanks' ? null
            : question.type === 'dropdown' ? h('fieldset', { class: 'knowledge-dropdown-rows', disabled: locked }, [
              h('legend', { class: 'visually-hidden' }, 'Match each row to an answer'),
              ...(question.matches ?? []).map((row, index) => h('label', { class: 'knowledge-dropdown-row', key: index }, [
                h('strong', row.label), h('select', {
                  value: blankResponses(question)[index] ?? '', 'aria-label': `Answer for ${row.label}`,
                  onChange: (event: Event) => blankResponse(question, index, inputValue(event)),
                }, [h('option', { value: '', disabled: true }, 'Choose an answer'),
                  ...choices.map(choice => h('option', { value: choice }, choice))]),
              ])),
            ]) : question.type === 'short-answer' ? h('label', { class: 'knowledge-field' }, ['Your answer', h('textarea', {
              rows: 3, value: textResponse(question), readonly: locked, maxlength: 2000,
              onInput: (event: Event) => response(question, inputValue(event)),
            })]) : h('fieldset', { class: 'knowledge-answer-choices', disabled: locked }, [h('legend', 'Your answer'),
              ...choices.map((choice, index) => h('label', { class: ['knowledge-answer-choice', {
                'is-selected': textResponse(question) === choice,
                'is-correct': showFeedback && !quizRetrying && choice === question.answer,
                'is-incorrect': showFeedback && textResponse(question) === choice && choice !== question.answer &&
                  (!quizRetrying || feedbackResponse(question) === choice),
              }], key: index, style: { '--review-delay': `${Math.min(index, 6) * 34}ms` } }, [
                h('input', { type: 'radio', name: `response-${question.id}`, checked: textResponse(question) === choice,
                  onChange: () => response(question, choice) }), h('span', choice),
                h('span', { class: 'knowledge-choice-marker', 'aria-hidden': 'true' }, textResponse(question) === choice ? '✓' : ''),
              ]))]),
          !scored ? null : props.mode !== 'test' ? h('div', {}, [
            h(Transition, { name: 'knowledge-feedback', mode: 'out-in', onBeforeLeave: leaveReviewPanel, onLeaveCancelled: restoreReviewPanel }, {
              default: () => showFeedback ? h('div', { key: `${question.id}-${attemptCount}` }, [feedback(question, study ? correct : !quizRetrying)]) : null,
            }),
            !locked ? h('button', {
              ref: question.type === 'fill-in-the-blanks' ? fillBlankPrimaryButton : undefined,
              type: 'button', class: 'card-primary-button',
              disabled: !canCheck, onClick: check,
            }, 'Check answer') : null,
          ]) : h('p', { class: 'knowledge-muted' }, 'Feedback is held until submission. You can change your answers.'),
          study && scored ? h('div', { class: 'knowledge-study-tools' }, [
            question.explanation || question.generated?.trace.length ? h('button', { type: 'button', class: 'quiet-button', onClick: () => {
              if (hints.value.has(question.id)) hints.value.delete(question.id); else hints.value.add(question.id);
            }, 'aria-expanded': hints.value.has(question.id), 'aria-controls': `hint-${question.id}` }, hints.value.has(question.id) ? 'Hide explanation' : 'Use explanation as a hint') : null,
            reveal(`hint-${question.id}`, hints.value.has(question.id) ? h('div', { id: `hint-${question.id}`, class: 'knowledge-study-answer' }, [
              question.explanation ? h('p', question.explanation) : null,
              question.generated?.trace.length ? h('ol', question.generated.trace.map(line => h('li', line))) : null,
            ]) : null),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => {
              if (revealed.value.has(question.id)) revealed.value.delete(question.id); else revealed.value.add(question.id);
            }, 'aria-expanded': revealed.value.has(question.id), 'aria-controls': `answer-${question.id}` }, revealed.value.has(question.id) ? 'Hide answer' : 'Show answer'),
            reveal(`answer-${question.id}`, revealed.value.has(question.id) ? h('div', { id: `answer-${question.id}`, class: 'knowledge-study-answer' },
              question.type === 'parameterized' ? [h('p', 'Answers:'), h('ul', (question.generated?.answers ?? []).map(answer => h('li', `${answer.label}: ${answer.text}`)))] :
              question.type === 'dropdown' ? [h('p', 'Answers:'), h('ul', (question.matches ?? []).map(row => h('li', `${row.label}: ${row.answer}`)))] :
                question.type === 'fill-in-the-blanks' ? [h('p', 'Answers:'), fillBlankAnswerKey(question)] : [h('p', `Answer: ${question.answer}`)]) : null),
          ]) : null,
        ]),
        }),
        h('div', { class: 'knowledge-session-navigation' }, [
          h('button', { type: 'button', class: 'quiet-button', disabled: position.value === 0,
            onClick: () => moveQuestion(position.value - 1) }, 'Previous'),
          position.value < questions.value.length - 1 ? h('button', {
            ref: question.type === 'fill-in-the-blanks' && props.mode === 'test' ? fillBlankPrimaryButton : undefined,
            type: 'button', class: 'card-primary-button',
            disabled: props.mode === 'quiz' && scored && !wasChecked,
            onClick: () => moveQuestion(position.value + 1),
          }, 'Next question') :
            !study ? h('button', {
              ref: question.type === 'fill-in-the-blanks' && props.mode === 'test' ? fillBlankPrimaryButton : undefined,
              type: 'button', class: 'card-primary-button',
              disabled: props.mode === 'quiz' && resolved.value !== questions.value.length,
              onClick: props.mode === 'test' ? submitTest : () => submit(),
            }, props.mode === 'test' ? 'Submit test' : 'See results') :
              h('button', {
                type: 'button',
                class: 'quiet-button knowledge-keep-studying',
                onClick: () => moveQuestion(0, true),
              }, ['Keep studying', h(Icon, { name: 'chevron' })]),
        ]),
      ]);
    }
    return () => h(Transition, { name: 'knowledge-view', mode: 'out-in', onBeforeLeave: leaveReviewPanel,
      onLeaveCancelled: restoreReviewPanel, onAfterEnter: enterReviewPanel }, { default: renderSession });
  },
});
