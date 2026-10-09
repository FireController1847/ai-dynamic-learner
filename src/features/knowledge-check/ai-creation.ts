import { computed, defineComponent, h, onMounted, ref, Transition } from 'vue';
import { AiCategoryPicker } from '../../components/ai-category-picker.ts';
import { AiPromptExchange } from '../../components/ai-prompt-exchange.ts';
import { MarkdownContent } from '../../components/markdown-content.ts';
import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import type { AiCardCategories, AiCardScope } from '../../core/ai-study-categories.ts';
import { inputValue } from '../../core/dom.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { parseReviewAiImport, reviewAiPrompt, type ReviewAiImport, type ReviewAiPreferences } from './ai-import-format.ts';
import { AI_QUESTION_TYPES, allocateQuestions, DEFAULT_AI_WEIGHTS, questionMixProblem, questionTypeLabel, rebalanceQuestionWeights } from './ai-question-mix.ts';
import { MAX_QUESTIONS, questionDisplayPrompt, type Question } from './question-model.ts';

export const ReviewAiCreation = defineComponent({
  name: 'ReviewAiCreation',
  props: { destination: { type: String, required: true } },
  emits: { cancel: () => true, create: (_value: ReviewAiImport) => true },
  setup(props, { emit }) {
    const stage = ref<'scope' | 'categories' | 'configure' | 'generate'>('scope');
    const scope = ref<AiCardScope | null>(null);
    const categories = ref<AiCardCategories | null>(null);
    const preferences = ref<ReviewAiPreferences>({ count: 20, coverage: 'balanced', weights: { ...DEFAULT_AI_WEIGHTS } });
    const json = ref('');
    const problem = ref('');
    const candidate = ref<ReviewAiImport | null>(null);
    const backward = ref(false);
    const heading = ref<HTMLElement | null>(null);
    const mixProblem = computed(() => questionMixProblem(preferences.value.weights, preferences.value.count));
    const counts = computed(() => mixProblem.value ? null : allocateQuestions(preferences.value.weights, preferences.value.count));
    const total = computed(() => AI_QUESTION_TYPES.reduce((sum, type) => sum + preferences.value.weights[type], 0));
    const prompt = computed(() => mixProblem.value ? '' : reviewAiPrompt(preferences.value, scope.value));
    onMounted(() => heading.value?.focus());
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
      const answers = question.type === 'dropdown' ? (question.matches ?? []).map(row => `${row.label}: ${row.answer}`) :
        question.type === 'fill-in-the-blanks' ? parseFillBlankTemplate(question.prompt).answers : [question.answer];
      return h('li', { key: question.id }, [
        h('span', { class: 'study-ai-muted' }, `${index + 1} · ${questionTypeLabel(question.type)}`),
        h('strong', questionDisplayPrompt(question)),
        question.context?.trim() ? h(MarkdownContent, { text: question.context, class: 'knowledge-question-context' }) : null,
        question.type === 'dropdown' ? h('ul', (question.matches ?? []).map(row => h('li', row.label))) : null,
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
            h('p', stage.value === 'scope' ? 'Choose the scope, set your question percentages, then generate and import the knowledge set.' : scope.value?.category.description ?? 'Cover the overall subject using your preferred question mix.'),
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
          h('fieldset', { class: 'review-ai-mix' }, [
            h('legend', 'Question type percentages'),
            ...AI_QUESTION_TYPES.map(type => h('label', { class: 'review-ai-weight', key: type }, [
              h('span', questionTypeLabel(type)),
              h('input', { type: 'number', min: 0, max: 100, step: 1, value: preferences.value.weights[type], 'aria-label': `${questionTypeLabel(type)} percentage`,
                onInput: (event: Event) => {
                  const text = inputValue(event).trim();
                  preferences.value.weights = rebalanceQuestionWeights(preferences.value.weights, type, text ? Number(text) : Number.NaN);
                  // Restore empty/invalid/clamped input even when its value didn't change.
                  if (event.target instanceof HTMLInputElement) event.target.value = String(preferences.value.weights[type]);
                } }),
              h('span', '%'), h('span', { class: 'study-ai-muted' }, counts.value ? `${counts.value[type]} items` : '—'),
            ])),
          ]),
          h('p', { role: 'status', class: mixProblem.value ? 'study-ai-error' : 'study-ai-muted' }, `Total: ${total.value}%. ${mixProblem.value || 'Changes are balanced evenly across the other types. Types at 0% are excluded.'}`),
          h('p', { class: 'study-ai-muted' }, 'Statements are not scored. You can still import an Index Cards set using the Library’s existing Import knowledge set action.'),
          h('div', { class: 'study-ai-actions' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { preferences.value.weights = { ...DEFAULT_AI_WEIGHTS }; } }, 'Reset percentages'),
            h('button', { type: 'button', class: 'card-primary-button', disabled: Boolean(mixProblem.value), onClick: () => go('generate') }, 'Generate prompt'),
          ]),
        ] : h(AiPromptExchange, {
          idPrefix: 'review-ai', label: 'Review', prompt: prompt.value, json: json.value, problem: problem.value,
          maxLength: MAX_AI_IMPORT_LENGTH, hasPreview: candidate.value !== null,
          promptHelp: scope.value ? 'Send this prompt in the conversation containing the matching source and categories. It creates the selected category’s knowledge set using your question mix.' : 'Give your AI the source material first, then send this prompt to construct the overall knowledge set using your question mix.',
          importHelp: 'Wait for the knowledge set response, then paste its JSON here. Every question and the requested type mix are validated before creation.',
          readyInstructions: ['Paste the Review JSON below.', 'Choose Validate JSON.', 'Review the questions, then create the knowledge set.'],
          onUpdateJson: (value: string) => { json.value = value; candidate.value = null; problem.value = ''; }, onValidate: validate,
        }, { preview: () => candidate.value ? h('div', { class: 'study-ai-preview' }, [
          h('h3', candidate.value.title), h('p', candidate.value.description),
          h('p', { role: 'status' }, `${candidate.value.questions.length} items · Requested question mix matched`),
          h('ol', { class: 'review-ai-preview' }, candidate.value.questions.map(previewQuestion)),
          h('button', { type: 'button', class: 'card-primary-button', onClick: () => { if (candidate.value) emit('create', candidate.value); } }, 'Create knowledge set'),
        ]) : null }),
      ]);
    }
    return () => h('div', { class: ['ai-workflow', { 'is-backward': backward.value }] }, [
      h(Transition, { name: 'ai-workflow-step', mode: 'out-in', onAfterEnter: (element: Element) => element.querySelector<HTMLElement>('h2[tabindex]')?.focus({ preventScroll: true }) }, { default: workspace }),
    ]);
  },
});
