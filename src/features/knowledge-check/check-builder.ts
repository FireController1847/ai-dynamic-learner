import { defaultSetOptions, validateSetOptions, type SetOptions } from './set-options.ts';
import { SetOptionsEditor } from './set-options-editor.ts';
import type { CheckItem } from './library-model.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import { createQuestion, questionHasContent, questionProblem, questionsForSave, MAX_QUESTIONS, MAX_TEXT, QUESTION_TYPES, type Question, type QuestionType } from './question-model.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { DeleteConfirmation } from '../../components/delete-confirmation.ts';
import { defineComponent, h, ref, computed, type PropType } from 'vue';

export const CheckBuilder = defineComponent({
  name: 'KnowledgeSetBuilder',
  props: {
    destination: { type: String, default: '' },
    item: { type: Object as PropType<CheckItem>, default: undefined },
  },
  emits: { save: (_name: string, _questions: Question[], _options: SetOptions) => true, cancel: () => true },
  setup(props, { emit }) {
    const name = ref(props.item?.name ?? 'New knowledge set');
    const questions = ref<Question[]>(props.item?.questions.map((question) => ({ ...question, choices: [...question.choices] })) ?? []);
    const selected = ref(0);
    const tab = ref<'questions' | 'options'>('questions');
    const options = ref<SetOptions>({ ...(props.item?.options ?? defaultSetOptions()) });
    const message = ref('');
    const invalid = computed(() => questions.value.findIndex(question => questionHasContent(question) && Boolean(questionProblem(question))));
    const optionsProblem = computed(() => {
      try { validateSetOptions(options.value); return ''; }
      catch (error) { return error instanceof Error ? error.message : String(error); }
    });
    function canLeaveQuestion(): boolean {
      const current = questions.value[selected.value];
      if (current && questionHasContent(current) && questionProblem(current)) {
        return false;
      }
      message.value = ''; return true;
    }
    function save() {
      try {
        if (invalid.value >= 0) { selected.value = invalid.value; tab.value = 'questions'; return; }
        validateSetOptions(options.value);
        emit('save', name.value.trim(), questionsForSave(questions.value), { ...options.value });
      } catch (error) { message.value = error instanceof Error ? error.message : String(error); }
    }
    const pendingDelete = ref<Question | null>(null);

    function addQuestion() {
      if (questions.value.length >= MAX_QUESTIONS || !canLeaveQuestion()) return;
      questions.value.push(createQuestion());
      selected.value = questions.value.length - 1;
    }
    function removeQuestion(question: Question) {
      questions.value = questions.value.filter((entry) => entry.id !== question.id);
      selected.value = Math.min(selected.value, Math.max(0, questions.value.length - 1));
      pendingDelete.value = null;
    }
    function changeType(question: Question, event: Event) {
      const type = inputValue(event);
      if (!QUESTION_TYPES.some((entry) => entry.id === type)) return;
      const replacement = createQuestion(type as QuestionType);
      Object.assign(question, { type: replacement.type, answer: replacement.answer, choices: replacement.choices });
    }
    function textField(label: string, key: 'prompt' | 'answer' | 'explanation', question: Question) {
      return h('label', { class: 'knowledge-field' }, [label, h('textarea', {
        value: question[key], maxlength: MAX_TEXT, rows: key === 'explanation' ? 3 : 4,
        onInput: (event: Event) => { question[key] = inputValue(event); },
      })]);
    }
    return () => {
      const question = questions.value[selected.value];
      return h('section', { class: 'knowledge-set-builder', 'aria-label': 'Knowledge set builder' }, [
        h('header', { class: 'knowledge-builder-header' }, [
          h('div', [h('h2', 'Build knowledge set'),
            h('p', 'Add questions, then use them to study or test yourself.')]),
          h('div', { class: 'knowledge-actions' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
            h('button', { type: 'button', class: 'card-primary-button', disabled: !name.value.trim() || invalid.value >= 0 || Boolean(optionsProblem.value),
              onClick: save },
            props.item ? 'Save questions' : 'Create knowledge set'),
          ]),
        ]),
        props.destination ? h('p', { class: 'knowledge-muted' }, `Saved in ${props.destination}.`) : null,
        h('label', { class: 'knowledge-field' }, ['Set name', h('input', {
          value: name.value, maxlength: MAX_NAME_LENGTH, onInput: (event: Event) => { name.value = inputValue(event); },
        })]),
        h('div', { class: 'knowledge-builder-tabs', role: 'group', 'aria-label': 'Builder pages' }, ['questions', 'options'].map(page => h('button', {
          type: 'button', class: 'quiet-button', 'aria-pressed': tab.value === page,
          onClick: () => { if (canLeaveQuestion()) tab.value = page as 'questions' | 'options'; },
        }, page === 'questions' ? 'Questions' : 'Set options'))),
        invalid.value >= 0 ? h('p', { class: 'knowledge-message', role: 'status' }, `Question ${invalid.value + 1}: ${questionProblem(questions.value[invalid.value]!)}`) : null,
        message.value ? h('p', { class: 'knowledge-message', role: 'alert' }, message.value) : null,
        optionsProblem.value ? h('p', { class: 'knowledge-message', role: 'alert' }, optionsProblem.value) : null,
        tab.value === 'options' ? h(SetOptionsEditor, { options: options.value }) : h('div', { class: 'knowledge-builder-layout' }, [
          h('aside', { class: 'knowledge-question-list', 'aria-label': 'Questions' }, [
            h('div', { class: 'knowledge-builder-header' }, [h('h3', `Questions (${questions.value.length})`),
              h('button', { type: 'button', class: 'icon-button', title: 'Add question', 'aria-label': 'Add question',
                disabled: questions.value.length >= MAX_QUESTIONS, onClick: addQuestion }, [h(Icon, { name: 'plus' })])]),
            ...questions.value.map((entry, index) => h('button', { key: entry.id, type: 'button',
              class: ['knowledge-question-row', { 'is-selected': index === selected.value }],
              'aria-pressed': index === selected.value, onClick: () => { if (index === selected.value || canLeaveQuestion()) selected.value = index; } },
            `${index + 1}. ${entry.prompt.trim() || 'Untitled question'}`)),
            !questions.value.length ? h('p', { class: 'knowledge-muted' }, 'Add your first question.') : null,
          ]),
          question ? h('div', { class: 'knowledge-question-editor', key: question.id }, [
            h('div', { class: 'knowledge-builder-header' }, [h('h3', `Question ${selected.value + 1}`),
              h('div', { class: 'knowledge-actions' }, [
                ...([-1, 1] as const).map((direction) => h('button', { type: 'button', class: 'quiet-button',
                  disabled: direction < 0 ? selected.value === 0 : selected.value === questions.value.length - 1,
                  onClick: () => { if (!canLeaveQuestion()) return; const index = selected.value; questions.value.splice(index, 1);
                    questions.value.splice(index + direction, 0, question); selected.value += direction; } }, direction < 0 ? 'Move up' : 'Move down')),
                h('button', { type: 'button', class: 'icon-button delete-button', 'aria-label': 'Delete question', title: 'Delete question',
                  onClick: () => { if (question.prompt.trim() || question.explanation.trim() ||
                    (question.type !== 'true-false' && question.answer.trim()) || question.choices.some((choice) => choice.trim())) pendingDelete.value = question;
                    else removeQuestion(question); } }, [h(Icon, { name: 'trash' })]),
              ])]),
            h('label', { class: 'knowledge-field' }, ['Question type', h('select', {
              value: question.type, onChange: (event: Event) => changeType(question, event),
            }, QUESTION_TYPES.map((type) => h('option', { value: type.id }, type.label)))]),
            textField('Question', 'prompt', question),
            question.type === 'multiple-choice' ? h('fieldset', { class: 'knowledge-choice-editor' }, [
              h('legend', 'Answer choices'),
              h('p', { class: 'knowledge-muted' }, 'Choose the correct answer.'),
              ...question.choices.map((choice, index) => h('div', { class: 'knowledge-choice-row', key: index }, [
                h('input', { type: 'radio', name: `correct-${question.id}`, checked: Boolean(choice) && question.answer === choice,
                  disabled: !choice.trim(), 'aria-label': `Choice ${index + 1} is correct`, onChange: () => { question.answer = choice; } }),
                h('input', { value: choice, maxlength: MAX_TEXT, 'aria-label': `Choice ${index + 1}`,
                  onInput: (event: Event) => { const next = inputValue(event); if (choice && question.answer === choice) question.answer = next;
                    question.choices[index] = next; } }),
                h('button', { type: 'button', class: 'icon-button delete-button', disabled: question.choices.length <= 2,
                  title: 'Remove choice', 'aria-label': `Remove choice ${index + 1}`, onClick: () => {
                    if (question.answer === choice) question.answer = ''; question.choices.splice(index, 1);
                  } }, [h(Icon, { name: 'trash' })]),
              ])),
              h('button', { type: 'button', class: 'quiet-button', disabled: question.choices.length >= 8,
                onClick: () => question.choices.push('') }, 'Add choice'),
            ]) : question.type === 'true-false' ? h('label', { class: 'knowledge-field' }, ['Correct answer', h('select', {
              value: question.answer, onChange: (event: Event) => { question.answer = inputValue(event); },
            }, [h('option', { value: '', disabled: true }, 'Select the correct answer'), ...['True', 'False'].map((answer) => h('option', { value: answer }, answer))])]) : textField('Expected answer', 'answer', question),
            textField('Explanation (optional)', 'explanation', question),
          ]) : h('div', { class: 'knowledge-question-editor knowledge-builder-empty' }, [h(Icon, { name: 'cards' }),
            h('h3', 'Add a question.'), h('button', { type: 'button', class: 'card-primary-button', onClick: addQuestion }, 'Add question')]),
        ]),
        pendingDelete.value ? h(DeleteConfirmation, { itemName: pendingDelete.value.prompt.trim() || 'Untitled question', itemLabel: 'question',
          detail: 'The question and its answer will be removed from this set.', confirmLabel: 'Delete question',
          onCancel: () => { pendingDelete.value = null; }, onConfirm: () => { if (pendingDelete.value) removeQuestion(pendingDelete.value); } }) : null,
      ]);
    };
  },
});
