import { computed, defineComponent, h, onMounted, ref } from 'vue';
import { AiCategoryPicker } from '../../components/ai-category-picker.ts';
import { inputValue } from '../../core/dom.ts';
import type { AiCardCategories, AiCardScope } from '../../core/ai-study-categories.ts';
import { reviewAiPrompt, type ReviewAiImport, type ReviewAiPreferences } from './ai-import-format.ts';
import { REVIEW_AI_FOCUSES, type ReviewAiFocus } from './ai-focus.ts';
import { AI_QUESTION_TYPES, allocateQuestions, DEFAULT_AI_WEIGHTS, normalizeQuestionWeights, questionCountProblem, questionMixProblem, questionTypeLabel, type QuestionWeights } from './ai-question-mix.ts';
import { ReviewAiResponseWorkspace } from './ai-response-workspace.ts';
import { DEFAULT_SESSION_QUESTION_LIMIT } from './set-options.ts';

export const ReviewAiCreation = defineComponent({
  name: 'ReviewAiCreation',
  props: { destination: { type: String, required: true } },
  emits: { cancel: () => true, create: (_value: ReviewAiImport) => true },
  setup(props, { emit }) {
    const heading = ref<HTMLElement | null>(null);
    const choosingCategory = ref(false);
    const scope = ref<AiCardScope | null>(null);
    const categories = ref<AiCardCategories | null>(null);
    const preferences = ref<ReviewAiPreferences>({
      count: 50, coverage: 'balanced', mixMode: 'ai', aiFocus: 'default', weights: { ...DEFAULT_AI_WEIGHTS },
    });
    const relativeWeights = ref<QuestionWeights>({ ...DEFAULT_AI_WEIGHTS });
    const normalizedWeights = computed(() => normalizeQuestionWeights(relativeWeights.value));
    const problem = computed(() => {
      const countProblem = questionCountProblem(preferences.value.count);
      if (countProblem) return countProblem;
      if (preferences.value.mixMode === 'ai') return '';
      return normalizedWeights.value
        ? questionMixProblem(normalizedWeights.value, preferences.value.count)
        : 'Choose at least one question type with a whole weight from 1 to 100.';
    });
    const effectivePreferences = computed<ReviewAiPreferences>(() => ({
      ...preferences.value, weights: normalizedWeights.value ?? { ...DEFAULT_AI_WEIGHTS },
    }));
    const counts = computed(() => preferences.value.mixMode === 'custom' && !problem.value
      ? allocateQuestions(effectivePreferences.value.weights, preferences.value.count) : null);
    function promptForCount(count: number) {
      if (problem.value || questionCountProblem(count)) return '';
      const prompt = reviewAiPrompt({ ...effectivePreferences.value, count }, scope.value);
      // Preserve the established educational instructions and schema; allow the source
      // to be attached to this message as well as supplied earlier.
      return 'Use the study material attached to this message or already supplied in this conversation. If no study material is available, ask for it before generating questions.\n\n' +
        prompt.replace('original source material supplied earlier in this conversation', 'original source material attached to this message or supplied earlier in this conversation');
    }
    const prompt = computed(() => promptForCount(preferences.value.count));
    onMounted(() => heading.value?.focus());

    function advancedOptions() {
      return h('details', { class: 'review-ai-secondary-details' }, [
        h('summary', 'Advanced options'),
        h('div', { class: 'review-ai-advanced' }, [
          h('div', { class: 'review-ai-inline-actions' }, [
            h('span', { class: 'study-ai-muted' }, scope.value ? 'Selected topic: ' + scope.value.category.title : 'Scope: entire subject'),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { choosingCategory.value = true; } }, scope.value ? 'Change topic' : 'Choose a specific topic'),
            scope.value ? h('button', { type: 'button', class: 'quiet-button', onClick: () => { scope.value = null; } }, 'Use entire subject') : null,
          ]),
          h('div', { class: 'review-ai-settings' }, [
            h('label', [
              h('span', 'Question types'),
              h('select', { value: preferences.value.mixMode, onChange: (event: Event) => {
                preferences.value.mixMode = inputValue(event) === 'custom' ? 'custom' : 'ai';
              } }, [
                h('option', { value: 'ai' }, 'Let AI choose'),
                h('option', { value: 'custom' }, 'Custom mix'),
              ]),
            ]),
            preferences.value.mixMode === 'ai' ? h('label', [
              h('span', 'Question focus'),
              h('select', { value: preferences.value.aiFocus ?? 'default', onChange: (event: Event) => {
                const focus = REVIEW_AI_FOCUSES.find(option => option.id === inputValue(event));
                if (focus) preferences.value.aiFocus = focus.id as ReviewAiFocus;
              } }, REVIEW_AI_FOCUSES.map(option => h('option', { value: option.id }, option.label))),
            ]) : null,
          ]),
          preferences.value.mixMode === 'ai'
            ? h('p', { class: 'study-ai-muted' }, REVIEW_AI_FOCUSES.find(option => option.id === preferences.value.aiFocus)?.description ?? '') : null,
          preferences.value.mixMode === 'custom' ? h('fieldset', { class: 'review-ai-mix' }, [
            h('legend', 'Question type weights'),
            h('p', { class: 'study-ai-muted' }, 'Set relative weights (0–100). Zero excludes a type. Dynamic Learner calculates the percentages and counts automatically.'),
            ...AI_QUESTION_TYPES.map(type => h('label', { class: 'review-ai-weight', key: type }, [
              h('span', questionTypeLabel(type)),
              h('input', { type: 'number', min: 0, max: 100, step: 1, value: relativeWeights.value[type],
                'aria-label': questionTypeLabel(type) + ' weight',
                onInput: (event: Event) => { relativeWeights.value[type] = Number(inputValue(event)); },
              }),
              h('span', normalizedWeights.value ? normalizedWeights.value[type] + '%' : '—'),
              h('span', { class: 'study-ai-muted' }, counts.value ? counts.value[type] + ' items' : '—'),
            ])),
            h('div', { class: 'review-ai-inline-actions' }, [
              h('button', { type: 'button', class: 'quiet-button', onClick: () => { relativeWeights.value = { ...DEFAULT_AI_WEIGHTS }; } }, 'Reset weights'),
            ]),
          ]) : null,
        ]),
      ]);
    }

    return () => h('div', { class: 'ai-workflow' }, [
      choosingCategory.value ? h(AiCategoryPicker, {
        label: 'Review', destination: props.destination, initialCategories: categories.value,
        onBack: () => { choosingCategory.value = false; },
        onCancel: () => { choosingCategory.value = false; },
        onSelect: (selected: AiCardScope, list: AiCardCategories) => {
          scope.value = selected; categories.value = list; choosingCategory.value = false;
        },
      }) : null,
      // Keep the draft mounted when visiting advanced topic selection.
      h('section', { class: 'study-ai-workspace review-ai-workspace', style: choosingCategory.value ? { display: 'none' } : undefined }, [
        h('header', { class: 'study-ai-header' }, [
          h('div', [
            h('p', { class: 'study-ai-muted' }, 'Review · Saved in ' + props.destination),
            h('h2', { ref: heading, tabindex: -1 }, 'Create with AI'),
            h('p', 'Choose what to study, generate questions in your AI chat, and bring the response back.'),
          ]),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
        ]),
        h('section', { class: 'review-ai-panel' }, [
          h('h3', 'Study preferences'),
          h('div', { class: 'review-ai-settings' }, [
            h('label', [
              h('span', 'Number of questions'),
              h('input', { type: 'number', min: 1, step: 1, value: preferences.value.count,
                onInput: (event: Event) => { preferences.value.count = Number(inputValue(event)); },
              }),
              h('small', { class: 'study-ai-muted' }, 'Up to ' + Math.min(preferences.value.count || 0, DEFAULT_SESSION_QUESTION_LIMIT) + ' per Study or Quiz session by default.'),
            ]),
            h('label', [
              h('span', 'Coverage'),
              h('select', { value: preferences.value.coverage, onChange: (event: Event) => {
                const value = inputValue(event);
                if (value === 'exam-prep' || value === 'essentials' || value === 'balanced') preferences.value.coverage = value;
              } }, [
                h('option', { value: 'exam-prep' }, 'Exam prep only'),
                h('option', { value: 'essentials' }, 'Essentials only'),
                h('option', { value: 'balanced' }, 'Balanced'),
              ]),
              h('small', { class: 'study-ai-muted' }, 'Likely exam content, core concepts, or a broad review.'),
            ]),
          ]),
          scope.value ? h('p', { class: 'study-ai-muted' }, 'Topic: ' + scope.value.category.title) : null,
          advancedOptions(),
          problem.value ? h('p', { class: 'study-ai-error', role: 'status' }, problem.value) : null,
        ]),
        h(ReviewAiResponseWorkspace, {
          preferences: effectivePreferences.value, prompt: prompt.value, promptForCount,
          onComplete: (value: ReviewAiImport) => emit('create', value),
        }),
      ]),
    ]);
  },
});
