import type { CheckItem } from './library-model.ts';
import type { CheckModeId } from './check-types.ts';
import { answerCorrect, questionReady, type Question } from './question-model.ts';
import { inputValue } from '../../core/dom.ts';
import { defineComponent, h, computed, ref, type PropType } from 'vue';

export const KnowledgeSession = defineComponent({
  name: 'KnowledgeSession',
  props: { item: { type: Object as PropType<CheckItem>, required: true }, mode: { type: String as PropType<CheckModeId>, required: true } },
  emits: { build: () => true },
  setup(props, { emit }) {
    const questions = computed(() => props.item.questions.filter(questionReady));
    const position = ref(0);
    const responses = ref<Record<string, string>>({});
    const checked = ref(new Set<string>());
    const revealed = ref(new Set<string>());
    const submitted = ref(false);
    const answered = computed(() => questions.value.filter((question) => responses.value[question.id]?.trim()).length);
    const score = computed(() => questions.value.filter((question) => answerCorrect(question, responses.value[question.id] ?? '')).length);
    function restart() {
      responses.value = {}; checked.value = new Set(); revealed.value = new Set(); submitted.value = false; position.value = 0;
    }
    function feedback(question: Question) {
      const correct = answerCorrect(question, responses.value[question.id] ?? '');
      return h('div', { class: ['knowledge-feedback', correct ? 'is-correct' : 'is-incorrect'], role: 'status' }, [
        h('strong', correct ? 'Correct' : 'Keep this one in mind'), h('p', `Answer: ${question.answer}`),
        question.explanation ? h('p', question.explanation) : null,
      ]);
    }
    return () => {
      const question = questions.value[position.value];
      if (!question) return h('section', { class: 'knowledge-session knowledge-builder-empty' }, [
        h('h3', 'Give this set something to work with.'), h('p', 'Add complete questions and answers in the builder, then return here.'),
        h('button', { type: 'button', class: 'card-primary-button', onClick: () => emit('build') }, 'Build questions'),
      ]);
      if (submitted.value) return h('section', { class: 'knowledge-session', 'aria-label': 'Results' }, [
        h('div', { class: 'knowledge-results-heading' }, [h('p', { class: 'knowledge-eyebrow' }, props.mode === 'test' ? 'Test complete' : 'Quiz complete'),
          h('h3', `${score.value} / ${questions.value.length}`), h('p', `${Math.round(score.value / questions.value.length * 100)}% correct`)]),
        ...questions.value.map((entry, index) => h('article', { class: 'knowledge-result', key: entry.id }, [
          h('h4', `${index + 1}. ${entry.prompt}`), h('p', `Your answer: ${responses.value[entry.id] || 'No answer'}`), feedback(entry),
        ])),
        h('button', { type: 'button', class: 'card-primary-button', onClick: restart }, 'Try again'),
      ]);
      const study = props.mode === 'study';
      const locked = checked.value.has(question.id);
      const choices = question.type === 'true-false' ? ['True', 'False'] : question.choices;
      return h('section', { class: 'knowledge-session', 'aria-label': `${props.mode} questions` }, [
        h('div', { class: 'knowledge-session-progress' }, [h('p', `Question ${position.value + 1} of ${questions.value.length}`),
          !study ? h('p', `${answered.value} answered`) : h('p', 'Take your time')]),
        questions.value.length < props.item.questions.length ? h('p', { class: 'knowledge-muted' },
          `${props.item.questions.length - questions.value.length} unfinished questions are saved in the builder and excluded from this session.`) : null,
        h('article', { class: 'knowledge-prompt', key: question.id }, [
          h('p', { class: 'knowledge-eyebrow' }, question.type.replaceAll('-', ' ')), h('h3', question.prompt),
          study ? h('div', [
            question.type !== 'short-answer' ? h('ul', { class: 'knowledge-study-choices' }, choices.map((choice) => h('li', choice))) : null,
            revealed.value.has(question.id) ? h('div', { class: 'knowledge-study-answer' }, [h('p', { class: 'knowledge-eyebrow' }, 'Answer'),
              h('p', question.answer), question.explanation ? h('p', question.explanation) : null]) : null,
            h('button', { type: 'button', class: 'card-primary-button', onClick: () => {
              if (revealed.value.has(question.id)) revealed.value.delete(question.id); else revealed.value.add(question.id);
            } }, revealed.value.has(question.id) ? 'Hide answer' : 'Reveal answer'),
          ]) : h('div', [
            question.type === 'short-answer' ? h('label', { class: 'knowledge-field' }, ['Your answer', h('textarea', {
              rows: 3, value: responses.value[question.id] ?? '', readonly: locked, maxlength: 2000,
              onInput: (event: Event) => { responses.value[question.id] = inputValue(event); },
            })]) : h('fieldset', { class: 'knowledge-answer-choices', disabled: locked }, [h('legend', 'Your answer'),
              ...choices.map((choice, index) => h('label', { class: ['knowledge-answer-choice', { 'is-selected': responses.value[question.id] === choice }], key: index }, [
                h('input', { type: 'radio', name: `response-${question.id}`, checked: responses.value[question.id] === choice,
                  onChange: () => { responses.value[question.id] = choice; } }), h('span', choice),
              ]))]),
            props.mode === 'quiz' ? locked ? feedback(question) : h('button', { type: 'button', class: 'card-primary-button',
              disabled: !responses.value[question.id]?.trim(), onClick: () => checked.value.add(question.id) }, 'Check answer') :
              h('p', { class: 'knowledge-muted' }, 'Answers and explanations stay hidden until you submit.'),
          ]),
        ]),
        h('div', { class: 'knowledge-session-navigation' }, [
          h('button', { type: 'button', class: 'quiet-button', disabled: position.value === 0, onClick: () => { position.value -= 1; } }, 'Previous'),
          position.value < questions.value.length - 1 ? h('button', { type: 'button', class: 'card-primary-button',
            disabled: props.mode === 'quiz' && !locked, onClick: () => { position.value += 1; } }, 'Next question') :
            !study ? h('button', { type: 'button', class: 'card-primary-button',
              disabled: props.mode === 'quiz' ? checked.value.size !== questions.value.length : answered.value !== questions.value.length,
              onClick: () => { submitted.value = true; } }, props.mode === 'test' ? 'Submit test' : 'See results') :
              h('button', { type: 'button', class: 'quiet-button', onClick: () => { position.value = 0; } }, 'Back to first question'),
        ]),
      ]);
    };
  },
});
