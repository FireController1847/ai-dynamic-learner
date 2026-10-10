import { computed, defineComponent, h, onMounted, ref, Transition } from 'vue';
import { AiCategoryPicker } from '../../components/ai-category-picker.ts';
import { AiPromptExchange } from '../../components/ai-prompt-exchange.ts';
import { MarkdownContent } from '../../components/markdown-content.ts';
import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import type { AiCardCategories, AiCardScope } from '../../core/ai-study-categories.ts';
import { inputValue } from '../../core/dom.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { parseReviewAiImport, reviewAiPrompt, type ReviewAiImport, type ReviewAiPreferences } from './ai-import-format.ts';
import { AI_QUESTION_TYPES, allocateQuestions, DEFAULT_AI_WEIGHTS, equalizeQuestionWeights, normalizeQuestionWeights, questionCountProblem, questionMixProblem, questionTypeLabel, rebalanceQuestionWeights, type QuestionWeights, type AiQuestionType } from './ai-question-mix.ts';
import { MAX_QUESTIONS, questionDisplayPrompt, type Question } from './question-model.ts';

export const ReviewAiCreation = defineComponent({
  name: 'ReviewAiCreation',
  props: { destination: { type: String, required: true } },
  emits: { cancel: () => true, create: (_value: ReviewAiImport) => true },
  setup(props, { emit }) {
    const stage = ref<'scope' | 'categories' | 'configure' | 'generate'>('scope');
    const scope = ref<AiCardScope | null>(null);
    const categories = ref<AiCardCategories | null>(null);
    const preferences = ref<ReviewAiPreferences>({ count: 20, coverage: 'balanced', mixMode: 'custom', weights: { ...DEFAULT_AI_WEIGHTS } });
    const json = ref('');
    const problem = ref('');
    const candidate = ref<ReviewAiImport | null>(null);
    const backward = ref(false);
    const heading = ref<HTMLElement | null>(null);
    const editingWeight = ref<AiQuestionType | null>(null);
    const weightText = ref('');
    const weightNotice = ref('');
    const editingMix = ref(false);
    const relativeTexts = ref<Record<AiQuestionType, string>>(Object.fromEntries(AI_QUESTION_TYPES.map(type => [type, '0'])) as Record<AiQuestionType, string>);
    const normalizedMix = computed(() => normalizeQuestionWeights(Object.fromEntries(AI_QUESTION_TYPES.map(type =>
      [type, relativeTexts.value[type].trim() ? Number(relativeTexts.value[type]) : 0])) as QuestionWeights));
    const mixProblem = computed(() => preferences.value.mixMode === 'ai'
      ? questionCountProblem(preferences.value.count)
      : questionMixProblem(preferences.value.weights, preferences.value.count));
    const counts = computed(() => preferences.value.mixMode !== 'custom' || mixProblem.value
      ? null : allocateQuestions(preferences.value.weights, preferences.value.count));
    const displayCounts = computed(() => editingMix.value
      ? normalizedMix.value && !questionMixProblem(normalizedMix.value, preferences.value.count)
        ? allocateQuestions(normalizedMix.value, preferences.value.count) : null
      : counts.value);
    const total = computed(() => AI_QUESTION_TYPES.reduce((sum, type) => sum + preferences.value.weights[type], 0));
    const prompt = computed(() => mixProblem.value ? '' : reviewAiPrompt(preferences.value, scope.value));
    onMounted(() => heading.value?.focus());
    function commitWeight(type: AiQuestionType, input?: HTMLInputElement) {
      if (editingWeight.value !== type) return;
      const requested = weightText.value.trim() ? Number(weightText.value) : Number.NaN;
      const previous = preferences.value.weights[type];
      const next = rebalanceQuestionWeights(preferences.value.weights, type, requested);
      weightNotice.value = previous === 100 && requested < 100 && next[type] === 100
        ? 'Enable another type before reducing the only enabled type. The active mix stays at 100%.' : '';
      preferences.value.weights = next;
      editingWeight.value = null;
      if (input) input.value = String(next[type]);
    }
    function editWholeMix() {
      if (editingWeight.value) commitWeight(editingWeight.value);
      relativeTexts.value = Object.fromEntries(AI_QUESTION_TYPES.map(type => [type, String(preferences.value.weights[type])])) as Record<AiQuestionType, string>;
      weightNotice.value = '';
      editingMix.value = true;
    }
    function go(next: typeof stage.value, back = false) { backward.value = back; stage.value = next; }
    function back() {
      candidate.value = null;
      problem.value = '';
      if (stage.value === 'generate') go('configure', true);
      else if (stage.value === 'configure') go(scope.value ? 'categories' : 'scope', true);
      else go('scope', true);
    }
    function validate() {
      candidate.value = null;
      problem.value = '';
      try { candidate.value = parseReviewAiImport(json.value, preferences.value); }
      catch (error) { problem.value = error instanceof Error ? error.message : String(error); }
    }
    function previewQuestion(question: Question, index: number) {
      const answers = question.type === 'parameterized' ? (question.parameters?.rules.answers ?? []).map(answer => `${answer.label}: ${answer.expression ?? `Solver output ${answer.solverKey}`}`) : question.type === 'dropdown' ? (question.matches ?? []).map(row => `${row.label}: ${row.answer}`) :
        question.type === 'fill-in-the-blanks' ? parseFillBlankTemplate(question.prompt).answers :
        question.correctAnswers ?? [question.answer];
      return h('li', { key: question.id }, [
        h('span', { class: 'study-ai-muted' }, `${index + 1} · ${questionTypeLabel(question.type)}`),
        h('strong', questionDisplayPrompt(question)),
        question.context?.trim() ? h(MarkdownContent, { text: question.context, class: 'knowledge-question-context' }) : null,
        question.type === 'dropdown' ? h('ul', (question.matches ?? []).map(row => h('li', row.label))) : null,
        question.parameters?.rules.solver?.package ? h('p', { class: 'study-ai-muted' }, `Includes uploaded solver: ${question.parameters.rules.solver.package.label}. Code runs only when previewing or reviewing a generated variant.`) : null,
        question.choices.length ? h('ul', question.choices.map(choice => h('li', choice))) : null,
        question.type !== 'statement' ? h('details', [h('summary', 'Reveal answer'),
          h('p', answers.join(' · ')), question.explanation ? h('p', question.explanation) : null]) : null,
      ]);
    }
    function workspace() {
      if (stage.value === 'categories') return h(AiCategoryPicker, {
        key: 'categories', label: 'Review', destination: props.destination, initialCategories: categories.value,
        onBack: () => go('scope', true), onCancel: () => emit('cancel'),
        onSelect: (selected: AiCardScope, list: AiCardCategories) => { scope.value = selected; categories.value = list; go('configure'); },
      });
      return h('section', { key: stage.value, class: 'study-ai-workspace review-ai-workspace' }, [
        h('header', { class: 'study-ai-header' }, [
          h('div', [h('p', { class: 'study-ai-muted' }, `Review · Saved in ${props.destination}`),
            h('h2', { ref: heading, tabindex: -1 }, stage.value === 'scope' ? 'Create a knowledge set with AI' : stage.value === 'configure' ? 'Choose your question mix' : scope.value?.category.title ?? 'Overall subject'),
            h('p', stage.value === 'scope'
              ? 'Choose the scope, then decide whether to set question percentages or let AI choose the most suitable types.'
              : scope.value?.category.description ?? 'Cover the overall subject using your chosen question-type strategy.'),
          ]),
          h('div', { class: 'study-ai-actions' }, [
            stage.value !== 'scope' ? h('button', { type: 'button', class: 'quiet-button', onClick: back }, 'Back') : null,
            h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
          ]),
        ]),
        stage.value === 'scope' ? h('div', { class: 'review-ai-scope' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { scope.value = null; go('configure'); } }, [h('strong', 'Overall subject'), h('span', 'Generate questions across the entire source.')]),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => go('categories') }, [h('strong', 'Choose a category'), h('span', 'Discover or reuse categories, then focus on one.')]),
        ]) : stage.value === 'configure' ? [
          h('div', { class: 'review-ai-settings' }, [
            h('label', [h('span', 'Total items'), h('input', { type: 'number', min: 1, max: MAX_QUESTIONS, step: 1, value: preferences.value.count,
              onInput: (event: Event) => { preferences.value.count = Number(inputValue(event)); } })]),
            h('label', [h('span', 'Coverage'), h('select', { value: preferences.value.coverage, onChange: (event: Event) => {
              const value = inputValue(event); if (value === 'essentials' || value === 'balanced' || value === 'comprehensive') preferences.value.coverage = value;
            } }, [h('option', { value: 'essentials' }, 'Essentials only'), h('option', { value: 'balanced' }, 'Balanced'), h('option', { value: 'comprehensive' }, 'Comprehensive')])]),
          ]),
          h('fieldset', { class: 'review-ai-mix-strategy' }, [
            h('legend', 'Question types'),
            h('label', { class: 'review-ai-mix-mode' }, [
              h('input', { type: 'radio', name: 'review-ai-mix-mode',
                checked: preferences.value.mixMode === 'custom',
                onChange: () => { preferences.value.mixMode = 'custom'; editingMix.value = false; editingWeight.value = null; },
              }),
              h('span', [h('strong', 'Custom percentages'),
                h('span', 'Set how many questions of each type you want.')]),
            ]),
            h('label', { class: 'review-ai-mix-mode' }, [
              h('input', { type: 'radio', name: 'review-ai-mix-mode',
                checked: preferences.value.mixMode === 'ai',
                onChange: () => { preferences.value.mixMode = 'ai'; editingMix.value = false; editingWeight.value = null; },
              }),
              h('span', [h('strong', 'Let AI choose'),
                h('span', 'AI chooses the types, prioritizing generated numeric questions and clear, reliably checked answers.')]),
            ]),
          ]),
          preferences.value.mixMode === 'custom' ? h('fieldset', { class: 'review-ai-mix' }, [
            h('legend', editingMix.value ? 'Set the whole mix using relative weights' : 'Question type percentages'),
            ...AI_QUESTION_TYPES.map(type => h('label', { class: 'review-ai-weight', key: type }, [
              h('span', questionTypeLabel(type)),
              h('input', { type: 'number', min: 0, max: 100, step: 1,
                value: editingMix.value ? relativeTexts.value[type] : editingWeight.value === type ? weightText.value : preferences.value.weights[type],
                'aria-label': `${questionTypeLabel(type)} ${editingMix.value ? 'relative weight' : 'percentage'}`,
                onFocus: () => {
                  if (!editingMix.value) { editingWeight.value = type; weightText.value = String(preferences.value.weights[type]); }
                },
                onInput: (event: Event) => {
                  if (editingMix.value) relativeTexts.value[type] = inputValue(event);
                  else { editingWeight.value = type; weightText.value = inputValue(event); }
                },
                onBlur: (event: FocusEvent) => {
                  if (!editingMix.value) commitWeight(type, event.target instanceof HTMLInputElement ? event.target : undefined);
                },
                onKeydown: (event: KeyboardEvent) => {
                  if (editingMix.value || event.key !== 'Enter') return;
                  event.preventDefault();
                  commitWeight(type, event.target instanceof HTMLInputElement ? event.target : undefined);
                },
              }),
              h('span', editingMix.value ? normalizedMix.value ? `→ ${normalizedMix.value[type]}%` : '—' : '%'),
              h('span', { class: 'study-ai-muted' }, displayCounts.value ? `${displayCounts.value[type]} items` : '—'),
            ])),
          ]) : null,
          preferences.value.mixMode === 'custom' ? h('p', { role: 'status', class: mixProblem.value ? 'study-ai-error' : 'study-ai-muted' }, `Active mix: ${total.value}%. ${mixProblem.value || (editingMix.value
            ? 'Edit all values freely, then apply the previewed percentages together. Zero stays excluded.'
            : 'Type a percentage, then press Enter or leave the field to balance the other enabled types. Zero stays excluded.')}`) : null,
          preferences.value.mixMode === 'custom' && editingMix.value ? h('p', { class: 'study-ai-muted' }, 'Relative weights need not total 100: for example, 2 / 1 / 1 becomes 50% / 25% / 25%. Blank or 0 excludes a type. Whole-number rounding is shown beside each field.') : null,
          preferences.value.mixMode === 'custom' && editingMix.value && !normalizedMix.value ? h('p', { class: 'study-ai-error', role: 'status' }, 'Use whole weights from 0 to 100, with at least one type above 0.') : null,
          preferences.value.mixMode === 'custom' && weightNotice.value ? h('p', { class: 'study-ai-muted', role: 'status' }, weightNotice.value) : null,
          preferences.value.mixMode === 'ai' ? h('p', { class: mixProblem.value ? 'study-ai-error' : 'study-ai-muted', role: 'status' },
            mixProblem.value || 'AI prioritizes procedural questions for numbers, single-word blanks, and a sensible mix of single- and multi-answer choices. Short Answer is used only when needed. Some types may be omitted.') : null,
          h('p', { class: 'study-ai-muted' }, 'Statements are not scored. You can still import an Index Cards set using the Library’s existing Import knowledge set action.'),
          h('div', { class: 'study-ai-actions' }, preferences.value.mixMode === 'ai' ? [
            h('button', { type: 'button', class: 'card-primary-button',
              disabled: Boolean(mixProblem.value), onClick: () => { if (!mixProblem.value) go('generate'); },
            }, 'Generate prompt'),
          ] : editingMix.value ? [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { editingMix.value = false; } }, 'Cancel mix edits'),
            h('button', { type: 'button', class: 'card-primary-button', disabled: !normalizedMix.value,
              onClick: () => { if (normalizedMix.value) { preferences.value.weights = { ...normalizedMix.value }; editingMix.value = false; } } }, 'Apply mix'),
          ] : [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { preferences.value.weights = equalizeQuestionWeights(preferences.value.weights); weightNotice.value = ''; } }, 'Equalize enabled types'),
            h('button', { type: 'button', class: 'quiet-button', onClick: editWholeMix }, 'Edit whole mix'),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { preferences.value.weights = { ...DEFAULT_AI_WEIGHTS }; weightNotice.value = ''; } }, 'Reset percentages'),
            h('button', { type: 'button', class: 'card-primary-button', disabled: Boolean(mixProblem.value), onClick: () => {
              if (editingWeight.value) commitWeight(editingWeight.value);
              if (!mixProblem.value) go('generate');
            } }, 'Generate prompt'),
          ]),
        ] : h(AiPromptExchange, {
          idPrefix: 'review-ai', label: 'Review', prompt: prompt.value, json: json.value, problem: problem.value,
          maxLength: MAX_AI_IMPORT_LENGTH, hasPreview: candidate.value !== null,
          promptHelp: scope.value
            ? `Send this prompt in the conversation containing the matching source and categories. It creates the selected category’s knowledge set ${preferences.value.mixMode === 'ai' ? 'with AI-selected question types' : 'using your percentages'}.`
            : `Give your AI the source material first, then send this prompt to create the overall knowledge set ${preferences.value.mixMode === 'ai' ? 'with an appropriate mix of question types' : 'using your percentages'}.`,
          importHelp: preferences.value.mixMode === 'ai'
            ? 'Paste the AI-generated JSON here. Each question is validated, and a different total count produces a warning. Any valid question-type mix is allowed.'
            : 'Paste the AI-generated JSON here. Questions are validated; differences from your requested count or mix produce warnings.',
          readyInstructions: ['Paste the Review JSON below.', 'Choose Validate JSON.', 'Review the questions, then create the knowledge set.'],
          onUpdateJson: (value: string) => { json.value = value; candidate.value = null; problem.value = ''; }, onValidate: validate,
        }, { preview: () => candidate.value ? h('div', { class: 'study-ai-preview' }, [
          h('h3', candidate.value.title), h('p', candidate.value.description),
          h('p', { role: 'status' }, `${candidate.value.questions.length} items · ${candidate.value.warnings.length
            ? 'Valid questions with import warnings'
            : preferences.value.mixMode === 'ai' ? 'AI-selected question mix' : 'Requested question mix matched'}`),
          candidate.value.warnings.length ? h('section', { class: 'review-ai-import-warning', role: 'status', 'aria-label': 'Import warnings' }, [
            h('strong', 'This JSON differs from the request'),
            h('ul', candidate.value.warnings.map(warning => h('li', warning))),
            h('p', 'You can still create the knowledge set with all of these questions.'),
          ]) : null,
          h('ol', { class: 'review-ai-preview' }, candidate.value.questions.map(previewQuestion)),
          h('button', { type: 'button', class: 'card-primary-button', onClick: () => { if (candidate.value) emit('create', candidate.value); } }, candidate.value.warnings.length ? 'Create knowledge set anyway' : 'Create knowledge set'),
        ]) : null }),
      ]);
    }
    return () => h('div', { class: ['ai-workflow', { 'is-backward': backward.value }] }, [
      h(Transition, { name: 'ai-workflow-step', mode: 'out-in', onAfterEnter: (element: Element) => element.querySelector<HTMLElement>('h2[tabindex]')?.focus({ preventScroll: true }) }, { default: workspace }),
    ]);
  },
});
