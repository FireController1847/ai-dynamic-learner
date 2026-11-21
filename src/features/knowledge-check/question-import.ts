import { computed, defineComponent, h, ref, type PropType } from 'vue';
import { AiPromptExchange } from '../../components/ai-prompt-exchange.ts';
import { AiCreationScope } from '../../components/ai-creation-scope.ts';
import { AiPromptStyleSelect } from '../../components/ai-prompt-style-select.ts';
import { simpleAiPrompt, type AiPromptVariant } from '../../core/ai-prompt-variants.ts';
import { AiCategoryPicker } from '../../components/ai-category-picker.ts';
import type { AiCardCategories, AiCardScope } from '../../core/ai-study-categories.ts';
import { reviewAiQuestionPreview } from './ai-question-preview.ts';
import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import { inputValue } from '../../core/dom.ts';
import { DEFAULT_AI_WEIGHTS, questionCountProblem } from './ai-question-mix.ts';
import { reviewAiPrompt, type ReviewAiImport } from './ai-import-format.ts';
import { questionDisplayPrompt, type Question } from './question-model.ts';
import { checkReviewResponse, ReviewAiRecoveryHelp, reviewRetryPrompt, reviewBatchPrompt } from './ai-import-recovery.ts';
import type { ReviewResponseRecovery } from './ai-response-recovery.ts';

export const ReviewQuestionImport = defineComponent({
  name: 'ReviewQuestionImport',
  props: {
    setName: { type: String, required: true },
    existing: { type: Array as PropType<Question[]>, required: true },
  },
  emits: {
    back: () => true,
    append: (_questions: Question[]) => true,
  },
  setup(props, { emit }) {
    const count = ref(20);
    const promptVariant = ref<AiPromptVariant>('detailed');
    const stage = ref<'scope' | 'categories' | 'import'>('scope');
    const scope = ref<AiCardScope | null>(null);
    const categories = ref<AiCardCategories | null>(null);
    const direct = ref(false);
    const json = ref('');
    const problem = ref('');
    const candidate = ref<ReviewAiImport | null>(null);
    const report = ref<ReviewResponseRecovery | null>(null);
    const recovering = ref(false);
    const adding = ref(false);
    const prompt = computed(() => {
      if (questionCountProblem(count.value)) return '';
      const questionsToAvoid = props.existing
        .map(question => questionDisplayPrompt(question).trim().replace(/\s+/g, ' '))
        .filter(Boolean);
      const existing = questionsToAvoid.length
        ? questionsToAvoid.map((question, index) => `${index + 1}. ${question.slice(0, 200)}`).join('\n')
        : '(No existing written questions)';
      return `I am adding questions to an EXISTING Dynamic Learner Review knowledge set named "${props.setName}". Generate ONLY new questions that complement the set, without repeating or paraphrasing the following existing questions.

Existing question prompts:
${existing}

Your answer must be a standalone valid Review JSON response with a title, description, and ONLY the additional questions. The title and description are required for the JSON format but will NOT replace my existing knowledge set name or options.

${(promptVariant.value === 'simple' ? simpleAiPrompt(reviewAiPrompt({
        count: count.value, mixMode: 'ai', coverage: 'balanced', weights: { ...DEFAULT_AI_WEIGHTS },
      }, scope.value), 'Review', 'Create additional questions without replacing the existing set.',
         ['Use exactly the requested count when supported; no duplicate or paraphrased existing questions.',
          'Use the supported question types, including parameterized or solver questions when supported.',
          'For multiple-choice, use plausible choices; for fill-in-the-blanks, place answers in {{markers}}.',
          'Explanations are gentle hints and must not reveal the correct answer.',
          'Include source-based confidence and coverage estimates.']) : reviewAiPrompt({
        count: count.value, mixMode: 'ai', coverage: 'balanced', weights: { ...DEFAULT_AI_WEIGHTS },
      }, scope.value))}`;
    });

    function validate() {
      problem.value = '';
      const result = checkReviewResponse(json.value, {
        count: count.value, mixMode: 'ai', coverage: 'balanced', weights: { ...DEFAULT_AI_WEIGHTS },
      }, { append: true, existing: props.existing, previous: candidate.value, add: adding.value });
      candidate.value = result.candidate;
      report.value = result;
      recovering.value = result.issues.length > 0;
      adding.value = false;
    }
    function retry(add: boolean, clear: boolean) {
      adding.value = add;
      if (clear) json.value = '';
      recovering.value = false;
      if (!add) { candidate.value = null; report.value = null; }
    }
    return () => stage.value === 'categories' ? h(AiCategoryPicker, {
      label: 'Review', targetApp: 'review', destination: props.setName, initialCategories: categories.value,
      onBack: () => { stage.value = 'scope'; }, onCancel: () => emit('back'),
      onSelect: (selected: AiCardScope, list: AiCardCategories) => {
        scope.value = selected; categories.value = list; direct.value = false; stage.value = 'import';
        json.value = ''; candidate.value = null; report.value = null; recovering.value = false;
      },
    }) : h('section', { class: 'knowledge-set-builder knowledge-question-import',
      'aria-label': 'Import additional questions' }, [
      h('header', { class: 'knowledge-builder-header' }, [
        h('div', [
          h('h2', 'Import questions'),
          h('p', `Append questions to ${props.setName} without replacing the existing ones.`),
        ]),
        stage.value === 'import' ? h('button', { type: 'button', class: 'quiet-button', onClick: () => {
          stage.value = 'scope'; candidate.value = null; report.value = null; recovering.value = false; json.value = '';
        } }, 'Change scope') : null,
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back to builder'),
      ]),
      ...(stage.value === 'scope' ? [h(AiCreationScope, {
        showExit: false,
        onOverall: () => { scope.value = null; direct.value = false; stage.value = 'import'; },
        onCategory: () => { stage.value = 'categories'; },
        onDirect: () => { scope.value = null; direct.value = true; stage.value = 'import'; },
      })] : [
      h(AiPromptStyleSelect, { value: promptVariant.value, onSelect: value => { promptVariant.value = value; } }),
      h('p', { class: 'knowledge-muted' },
        `${props.existing.length} existing questions`),
      h('label', { class: 'knowledge-field knowledge-question-import-count' }, [
        direct.value ? 'Maximum new questions to import' : 'Number of new questions to request',
        h('input', {
          type: 'number', min: 1, step: 1, value: count.value,
          onInput: (event: Event) => {
            const next = Number(inputValue(event));
            count.value = Number.isFinite(next) ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(next))) : 1;
            candidate.value = null;
            report.value = null;
            recovering.value = false;
            adding.value = false;
            problem.value = '';
          },
        }),
      ]),
      h('p', { class: 'knowledge-muted' },
        'Add more questions from an AI response without replacing your existing ones.'),
      recovering.value && report.value ? h(ReviewAiRecoveryHelp, {
        report: report.value, accepted: candidate.value?.questions.length ?? 0,
        repairPrompt: reviewRetryPrompt(report.value, count.value, candidate.value?.questions.length ?? 0),
        batchPrompt: count.value > (candidate.value?.questions.length ?? 0) + 25
          ? reviewBatchPrompt(reviewAiPrompt({
            count: Math.min(25, count.value - (candidate.value?.questions.length ?? 0)),
            mixMode: 'ai', coverage: 'balanced', weights: { ...DEFAULT_AI_WEIGHTS },
          }, scope.value), [...props.existing, ...(candidate.value?.questions ?? [])]) : '',
        onRetry: () => retry(Boolean(candidate.value), true),
        onReview: () => { recovering.value = false; },
        onBack: () => { recovering.value = false; },
      }) : h(AiPromptExchange, {
        idPrefix: 'review-question-append', label: 'Review questions',
        prompt: prompt.value, json: json.value, problem: problem.value,
        maxLength: MAX_AI_IMPORT_LENGTH, hasPreview: candidate.value !== null && !adding.value,
        startInImport: direct.value || report.value !== null,
        importOnly: direct.value, skipSource: Boolean(scope.value),
        promptHelp: 'These instructions request additional questions and help your AI avoid repeating existing ones.',
        importHelp: adding.value && candidate.value
          ? `${candidate.value.questions.length} new questions are safe. Paste the AI’s next response to add to them.`
          : 'Upload or paste the AI response you want to add. Existing questions and settings stay unchanged.',
        onUpdateJson: (value: string) => { json.value = value; if (!adding.value) candidate.value = null; problem.value = ''; },
        onValidate: validate,
      }, {
        preview: () => candidate.value ? h('div', { class: 'study-ai-preview' }, [
          h('h3', `${candidate.value.questions.length} new questions ready`),
          h('p', { class: 'knowledge-muted' },
            'Only questions are added. Imported titles and descriptions are ignored. Nothing is saved until you save the builder.'),
          report.value && (report.value.issues.length || report.value.notices.length || report.value.recovered) ? h('details', { class: 'review-ai-warning-details' }, [
            h('summary', 'Response recovery details'),
            h('ul', [...report.value.notices, ...report.value.issues.map(issue => issue.message)].map(message => h('li', message))),
            report.value.issues.length ? h('button', { type: 'button', class: 'quiet-button', onClick: () => { recovering.value = true; } }, 'Fix remaining questions') : null,
          ]) : null,
          candidate.value.warnings.length ? h('section', { class: 'review-ai-import-warning',
            role: 'status', 'aria-label': 'Import warnings' }, [
            h('strong', 'Review these warnings'),
            h('ul', candidate.value.warnings.map(warning => h('li', warning))),
          ]) : null,
          h('ol', { class: 'review-ai-preview' }, candidate.value.questions.map(reviewAiQuestionPreview)),
          h('button', { type: 'button', class: 'card-primary-button', onClick: () => {
            if (candidate.value) emit('append', candidate.value.questions);
          } }, `Add ${candidate.value.questions.length} ${candidate.value.questions.length === 1 ? 'question' : 'questions'} to builder`),
        ]) : null,
      }),
      ]),
    ]);
  },
});
