import { computed, defineComponent, h, onMounted, ref, Transition } from 'vue';
import { AiCategoryPicker } from '../../components/ai-category-picker.ts';
import { AiCreationScope } from '../../components/ai-creation-scope.ts';
import { AiSourceUnitCoverage } from '../../components/ai-source-unit-coverage.ts';
import { AiMissingConfidence } from '../../components/ai-missing-confidence.ts';
import { AiCoverageSelect } from '../../components/ai-coverage-select.ts';
import { AiPromptStyleSelect } from '../../components/ai-prompt-style-select.ts';
import { AiOptionsHeader } from '../../components/ai-options-header.ts';
import { DEFAULT_AI_PROMPT_VARIANT, simpleAiPrompt, type AiPromptVariant } from '../../core/ai-prompt-variants.ts';
import { Icon } from '../../components/icon.ts';
import { AiPromptExchange, type AiPromptExchangeHandle } from '../../components/ai-prompt-exchange.ts';
import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import { DEFAULT_SESSION_QUESTION_LIMIT } from './set-options.ts';
import type { AiCardCategories, AiCardScope } from '../../core/ai-study-categories.ts';
import { inputValue } from '../../core/dom.ts';
import { reviewAiPrompt, type ReviewAiImport, type ReviewAiPreferences } from './ai-import-format.ts';

import { REVIEW_AI_FOCUSES, type ReviewAiFocus } from './ai-focus.ts';
import { AiFocusChoices } from '../../components/ai-focus-choices.ts';
import { AI_QUESTION_TYPES, allocateQuestions, DEFAULT_AI_WEIGHTS, equalizeQuestionWeights, normalizeQuestionWeights, questionCountProblem, questionMixProblem, questionTypeLabel, rebalanceQuestionWeights, type QuestionWeights, type AiQuestionType } from './ai-question-mix.ts';
import { reviewAiQuestionPreview } from './ai-question-preview.ts';
import { questionDisplayPrompt } from './question-model.ts';
import { checkReviewResponse, reviewRetryPrompt, reviewBatchPrompt, ReviewAiRecoveryHelp } from './ai-import-recovery.ts';
import type { ReviewResponseRecovery } from './ai-response-recovery.ts';

export const ReviewAiCreation = defineComponent({
  name: 'ReviewAiCreation',
  props: { destination: { type: String, required: true } },
  emits: { cancel: () => true, create: (_value: ReviewAiImport) => true },
  setup(props, { emit }) {
    const stage = ref<'scope' | 'categories' | 'configure' | 'generate' | 'direct' | 'review' | 'recovery'>('scope');
    const importedDirectly = ref(false);
    const promptVariant = ref<AiPromptVariant>(DEFAULT_AI_PROMPT_VARIANT);
    const returningFromReview = ref(false);
    const scope = ref<AiCardScope | null>(null);
    const categories = ref<AiCardCategories | null>(null);
    const preferences = ref<ReviewAiPreferences>({ count: 50, coverage: 'balanced', mixMode: 'ai', aiFocus: 'default', weights: { ...DEFAULT_AI_WEIGHTS } });
    const json = ref('');
    const problem = ref('');
    const candidate = ref<ReviewAiImport | null>(null);
    const report = ref<ReviewResponseRecovery | null>(null);
    const adding = ref(false);
    const batchOnly = ref(false);
    const retrying = ref(false);
    const acceptedCount = computed(() => candidate.value?.questions.length ?? 0);
    function createPrompt(options: ReviewAiPreferences): string {
      const detailed = reviewAiPrompt(options, scope.value);
      return promptVariant.value === 'simple' ? simpleAiPrompt(detailed, 'Review',
        `Create exactly ${options.count} useful, distinct questions when the source supports that many${scope.value ? ' for the selected category ' + scope.value.category.title : ' for the overall subject'}. Coverage: ${options.coverage}.`,
        ['Follow the selected question mix and focus. Use all supported types only when appropriate.',
         'Use source-supported formulas and solver packages for parameterized problems; do not invent ranges.',
         'Use 2–8 plausible choices for multiple-choice and matching, and {{answer}} for fill-in-the-blanks.',
         'Write clear, unambiguous questions with brief supportive explanations that never give away answers.',
         'Include all four confidence estimates, coverage explanation, and uncovered subjects; never inflate them.',
         'Do not exceed the requested question count or invent filler.']) : detailed;
    }
    const batchPrompt = computed(() => {
      const remaining = preferences.value.count - acceptedCount.value;
      if (importedDirectly.value || remaining <= 0 || mixProblem.value) return '';
      return reviewBatchPrompt(createPrompt({ ...preferences.value, count: Math.min(25, remaining) }), candidate.value?.questions ?? []);
    });
    const examPrep = computed(() => !importedDirectly.value && preferences.value.coverage === 'exam-prep');
    const selectiveCoverage = computed(() => !importedDirectly.value && preferences.value.coverage !== 'balanced');
    const lowConfidenceMetrics = computed(() => {
      const confidence = candidate.value?.confidence;
      if (!confidence) return [];
      const metrics = [
        ['Overall coverage', confidence.overallCoverage], ['Exam confidence', confidence.examConfidence],
        ['Subject confidence', confidence.subjectConfidence], ['Study confidence', confidence.studyConfidence],
      ] as const;
      return metrics.filter(([label, value]) => value < 80 && (!selectiveCoverage.value || label !== 'Overall coverage'));
    });

    const validationRevision = ref(0);
    const correctionMessage = ref('');
    const correctionFallback = ref(false);
    const backward = ref(false);
    const heading = ref<HTMLElement | null>(null);
    const exchange = ref<AiPromptExchangeHandle | null>(null);
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
    const prompt = computed(() => mixProblem.value ? '' : createPrompt(preferences.value));
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
    function returnToResponse(add: boolean, clear: boolean) {
      adding.value = add;
      batchOnly.value = false;
      retrying.value = true;
      returningFromReview.value = true;
      problem.value = '';
      if (clear) json.value = '';
      go(importedDirectly.value ? 'direct' : 'generate', true);
    }
    function resetDraft() {
      candidate.value = null;
      report.value = null;
      json.value = '';
      adding.value = false;
      batchOnly.value = false;
      retrying.value = false;
      returningFromReview.value = false;
    }
    function back() {
      problem.value = '';
      if (stage.value === 'review' || stage.value === 'recovery') { returnToResponse(false, false); return; }
      if ((stage.value === 'generate' || stage.value === 'direct') && retrying.value && candidate.value) {
        retrying.value = false;
        go('review', true);
        return;
      }
      if ((stage.value === 'generate' || stage.value === 'direct') && exchange.value?.goBack()) return;
      if (stage.value === 'direct') { resetDraft(); go('scope', true); }
      else if (stage.value === 'generate') { resetDraft(); go('configure', true); }
      else if (stage.value === 'configure') go(scope.value ? 'categories' : 'scope', true);
      else go('scope', true);
    }
    function validate() {
      validationRevision.value++;
      problem.value = '';
      importedDirectly.value = stage.value === 'direct';
      const result = checkReviewResponse(json.value, preferences.value, {
        direct: importedDirectly.value, previous: candidate.value, add: adding.value,
      });
      report.value = result;
      candidate.value = result.candidate;
      adding.value = false;
      retrying.value = false;
      returningFromReview.value = false;
      go(result.issues.length || !result.candidate ? 'recovery' : 'review');
    }
    function countCorrection() {
      const coverage = examPrep.value ? 'EXAM PREP ONLY: keep ONLY material you are almost CERTAIN WILL be tested based on explicit exam evidence. IGNORE other material. Report missing strongly evidenced exam topics; never add speculative questions to meet the count.' : selectiveCoverage.value ? 'ESSENTIALS ONLY: keep core concepts and report omitted essentials; do not add minor details.' : 'If the count prevents full coverage, identify the uncovered topics.';
      return `Return at most ${preferences.value.count} meaningful questions. Combine related concepts where useful; remove redundant questions without losing important distinctions. ${coverage} Report relevant gaps in confidence.uncoveredSubjects, adjust overallCoverage honestly, and return COMPLETE corrected JSON. Never exceed the requested question count.`;
    }
    function lowConfidencePrompt() {
      const result = candidate.value;
      if (!result?.confidence) return '';
      const low = lowConfidenceMetrics.value.map(([name, value]) => name + ': ' + value + '%');
      const coverage = examPrep.value ? 'Keep EXAM PREP ONLY: EXPLICITLY focus on material you are almost CERTAIN WILL be on the exam. IGNORE other material; only add questions with strong exam evidence. ' : selectiveCoverage.value ? 'Keep ESSENTIALS ONLY: add core concepts, not minor details. ' : '';
      const suggested = Math.min(Number.MAX_SAFE_INTEGER, Math.max(preferences.value.count + 10, Math.ceil(preferences.value.count * 1.5)));
      return 'Please improve the existing Dynamic Learner Review knowledge set using the original source. These AI-estimated scores fell below 80%: ' +
        low.join('; ') + '. Re-evaluate WHY each is low. ' + coverage + 'If more questions would genuinely increase coverage or study value within the selected scope, regenerate up to ' +
        suggested + ' meaningful questions (never exceed this limit), including underrepresented subjects within the selected scope; preserve accurate, in-scope material and avoid filler. ' +
        'If the problem is insufficient source evidence, subject mismatch, or unknown exam content, clearly identify what additional study material is needed rather than claiming more questions will fix it. ' +
        'Update all four confidence estimates, explanations and uncoveredSubjects honestly. Return the COMPLETE corrected JSON in the same schema; explanations must gently guide reasoning without giving away answers.';
    }
    async function requestLowConfidence() {
      const message = lowConfidencePrompt();
      if (!message) return;
      try {
        await navigator.clipboard.writeText(message);
        correctionMessage.value = 'Improvement request copied. Send it in the same AI conversation, then return to Step 4 to paste and validate the new JSON.';
        correctionFallback.value = false;
      } catch {
        correctionMessage.value = 'Copy the improvement request below into the same AI conversation.';
        correctionFallback.value = true;
      }
    }
        async function requestExactCount() {
      const message = countCorrection();
      correctionMessage.value = '';
      correctionFallback.value = false;
      try {
        await navigator.clipboard.writeText(message);
        correctionMessage.value = 'Request copied. Paste it into your existing AI conversation, send it, then replace the reply above and select Check and preview.';
      } catch {
        correctionFallback.value = true;
        correctionMessage.value = 'Copying was blocked. Select this request and send it to the same AI chat.';
      }
    }
    function workspace() {
      if (stage.value === 'categories') return h(AiCategoryPicker, {
        key: 'categories', label: 'Review', targetApp: 'review', destination: props.destination, initialCategories: categories.value,
        onBack: () => go('scope', true), onCancel: () => emit('cancel'),
        onSelect: (selected: AiCardScope, list: AiCardCategories) => { scope.value = selected; categories.value = list; go('configure'); },
      });
      return h('section', { key: stage.value, class: 'study-ai-workspace review-ai-workspace' }, [
        stage.value === 'configure' ? h(AiOptionsHeader, {
          app: 'Review', destination: props.destination, title: 'Configure questions',
          scope: scope.value?.category.title ?? 'Overall subject', onBack: back,
          onCancel: () => emit('cancel'),
        }) : h('header', { class: 'study-ai-header' }, [
          h('div', [h('p', { class: 'study-ai-muted' }, `Review · Saved in ${props.destination}`),
            h('h2', { ref: heading, tabindex: -1 }, stage.value === 'scope' ? 'Create a knowledge set with AI' : scope.value?.category.title ?? 'Overall subject'),
            h('p', stage.value === 'scope'
              ? 'Choose how much of the material your questions should cover.'
              : scope.value?.category.description ?? 'Cover the overall subject using your chosen question-type strategy.'),
          ]),
          h('div', { class: 'study-ai-actions' }, [
            stage.value !== 'scope' ? h('button', { type: 'button', class: 'quiet-button', onClick: back }, 'Back') : null,
            stage.value !== 'scope' ? h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel') : null,
          ]),
        ]),
        stage.value === 'scope' ? h(AiCreationScope, {
          onOverall: () => { scope.value = null; go('configure'); },
          onCategory: () => go('categories'),
          onDirect: () => { scope.value = null; go('direct'); },
          onExit: () => emit('cancel'),
        }) : stage.value === 'configure' ? [
          h('div', { class: 'ai-options-grid' }, [
            h(AiPromptStyleSelect, { value: promptVariant.value,
              onSelect: value => { promptVariant.value = value; },
            }),
            h('label', { class: 'ai-options-field' }, [h('span', 'Total questions'), h('input', { type: 'number', min: 1, step: 1, value: preferences.value.count,
              onInput: (event: Event) => { preferences.value.count = Number(inputValue(event)); } }), h('small', { class: 'study-ai-muted' }, 'Number of questions the AI should make.')]),
            h(AiCoverageSelect, { value: preferences.value.coverage,
              onSelect: value => { preferences.value.coverage = value; },
            }),
          ]),
          h('div', { class: 'review-ai-question-bank' }, [
            h('div', { class: 'review-ai-bank-counts' }, [
              h('div', [h('strong', String(preferences.value.count)), h('span', 'Questions in your set')]),
              h(Icon, { name: 'chevron' }),
              h('div', [h('strong', String(Math.min(preferences.value.count, DEFAULT_SESSION_QUESTION_LIMIT))), h('span', 'Per Study / Quiz by default')]),
            ]),
            h('p', 'Build a larger question bank so each Study session can sample a different set of questions. The Quiz and Study limit starts at 25 and can be changed later in set options.'),
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
          preferences.value.mixMode === 'ai' ? h(AiFocusChoices, {
            options: REVIEW_AI_FOCUSES,
            value: preferences.value.aiFocus ?? 'default',
            name: 'review-ai-focus',
            onSelect: (id: string) => { preferences.value.aiFocus = id as ReviewAiFocus; },
          }) : null,
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
          preferences.value.mixMode === 'ai' && mixProblem.value
            ? h('p', { class: 'study-ai-error', role: 'status' }, mixProblem.value) : null,
          h('p', { class: 'study-ai-muted' }, 'Statements are not scored. You can still import an Index Cards set using the Library’s existing Import knowledge set action.'),
          h('div', { class: 'study-ai-actions' }, preferences.value.mixMode === 'ai' ? [
            h('button', { type: 'button', class: 'card-primary-button',
              disabled: Boolean(mixProblem.value), onClick: () => { if (!mixProblem.value) go('generate'); },
            }, 'Continue to AI'),
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
            } }, 'Continue to AI'),
          ]),
        ] : stage.value === 'recovery' && report.value ? h(ReviewAiRecoveryHelp, {
          key: validationRevision.value, report: report.value, accepted: acceptedCount.value,
          repairPrompt: batchOnly.value ? batchPrompt.value : reviewRetryPrompt(report.value, preferences.value.count, acceptedCount.value),
          batchOnly: batchOnly.value,
          onRetry: () => returnToResponse(batchOnly.value && Boolean(candidate.value), true),
          onReview: () => { batchOnly.value = false; if (candidate.value) go('review'); },
          onBack: () => returnToResponse(false, false),
        }) : stage.value === 'review' && candidate.value ? h('div', { class: 'review-ai-final' }, [
          h('div', { class: 'ai-exchange-progress', 'aria-label': 'AI creation progress' }, [
            h('span', { class: 'is-complete' }, '1 · Source'), h(Icon, { name: 'chevron' }),
            h('span', { class: 'is-complete' }, '2 · Copy'), h(Icon, { name: 'chevron' }),
            h('span', { class: 'is-complete' }, '3 · Send'), h(Icon, { name: 'chevron' }),
            h('span', { class: 'is-complete' }, '4 · Return'), h(Icon, { name: 'chevron' }),
            h('span', { class: 'is-active', 'aria-current': 'step' }, '5 · Review'),
          ]),
          h('p', { class: 'study-ai-muted' }, 'Step 5 · Review the generated set before creating it. Percentages are the AI’s subjective estimates, not measured probabilities.'),
          candidate.value.confidence ? h('section', { class: 'review-ai-confidence', 'aria-label': 'AI confidence summary' }, [
            h('div', { class: 'review-ai-coverage-ring', style: { '--coverage': String(candidate.value.confidence.overallCoverage) + '%' } }, [
              h('div', [h('strong', candidate.value.confidence.overallCoverage + '%'), h('span', 'Overall coverage')]),
            ]),
            h('div', { class: 'review-ai-confidence-metrics' }, [
              ...([
                ['Exam confidence', candidate.value.confidence.examConfidence, 'How closely these questions are expected to match likely exam topics. This is an estimate, not knowledge of the actual exam.'],
                ['Subject confidence', candidate.value.confidence.subjectConfidence, 'How accurately the questions align with the subject and supplied material.'],
                ['Study confidence', candidate.value.confidence.studyConfidence, 'How useful practicing these questions is expected to be for learning and exam preparation.'],
              ] as const).map(([label, value, explanation]) => h('div', { class: 'review-ai-metric', key: label }, [
                h('div', [h('strong', label), h('span', value + '%')]),
                h('p', { class: 'review-ai-metric-help' }, explanation),
                h('div', { class: 'review-ai-meter', role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0,
                  'aria-valuemax': 100, 'aria-valuenow': value }, [
                  h('span', { style: { width: value + '%' } }),
                ]),
              ])),
            ]),
            h('p', { class: 'review-ai-coverage-help' }, examPrep.value
              ? 'Overall coverage measures the full source. Lower coverage is expected when Exam prep only excludes material without strong exam evidence.'
              : selectiveCoverage.value ? 'Overall coverage measures the full source. Lower coverage is expected when Essentials only excludes nonessential material.'
              : 'Overall coverage measures how much of the supplied material or selected category these questions address. A high value means broad source coverage, not a guaranteed exam result.'),
            h('div', { class: 'review-ai-confidence-notes' }, [
              h('p', candidate.value.confidence.coverageExplanation),
              candidate.value.confidence.uncoveredSubjects.length
                ? h('div', [
                    h('strong', examPrep.value ? 'Potentially missing exam topics' : selectiveCoverage.value ? 'Potentially missing essentials' : 'Potentially missing coverage'),
                    h('ul', candidate.value.confidence.uncoveredSubjects.map((subject, i) => h('li', { key: i }, subject))),
                  ]) : null,
              h('p', candidate.value.confidence.confidenceExplanation),
            ]),
          ]) : h(AiMissingConfidence, {
            app: 'Review', items: candidate.value.questions.map(question => questionDisplayPrompt(question)),
            onApply: confidence => {
              if (candidate.value) candidate.value = { ...candidate.value, confidence };
            },
          }),
          lowConfidenceMetrics.value.length ? h('section', { class: 'review-ai-difference', role: 'status' }, [
            h('strong', 'One or more confidence estimates are below 80%'),
            h('p', examPrep.value
              ? 'You can ask the AI to improve the set without adding speculative exam content. It may need more explicit exam guidance.'
              : 'You can ask the AI to improve the set. It will suggest more questions when useful, or explain what additional source material is needed.'),
            !importedDirectly.value ? h('button', { type: 'button', class: 'card-primary-button', onClick: () => {
              resetDraft();
              go('configure', true);
            } }, 'Increase question count') : null,
            h('button', { type: 'button', class: 'quiet-button', onClick: requestLowConfidence }, 'Copy improvement prompt'),
            correctionMessage.value ? h('p', { role: 'status' }, correctionMessage.value) : null,
            correctionFallback.value ? h('textarea', { readonly: true, rows: 5, value: lowConfidencePrompt(), 'aria-label': 'Confidence improvement prompt' }) : null,
          ]) : null,
                    h('h3', candidate.value.title),
          h('p', candidate.value.description),
          candidate.value.sourceUnits?.length ? h(AiSourceUnitCoverage, {
            units: candidate.value.sourceUnits,
            items: candidate.value.questions.map(q => questionDisplayPrompt(q)), itemLabel: 'questions',
          }) : null,
          h('div', { class: 'review-ai-preview-counts', role: 'status' }, [
            !importedDirectly.value ? h('div', [h('strong', String(preferences.value.count)), h('span', 'Requested')]) : null,
            !importedDirectly.value ? h(Icon, { name: 'chevron' }) : null,
            h('div', [h('strong', String(candidate.value.questions.length)), h('span', 'Received from AI')]),
          ]),
          !importedDirectly.value && candidate.value.questions.length !== preferences.value.count
            ? h('section', { class: 'review-ai-difference', role: 'status' }, [
                h('strong', examPrep.value && candidate.value.questions.length < preferences.value.count ? 'Fewer exam-supported questions received' : 'The AI did not follow the requested question count'),
                h('p', `Requested ${preferences.value.count}; received ${candidate.value.questions.length}. Dynamic Learner has not removed any questions. ${examPrep.value && candidate.value.questions.length < preferences.value.count ? 'Fewer questions are acceptable when strong exam evidence does not support the requested count.' : 'You can ask the AI to regenerate within the requested limit.'}`),
                examPrep.value && candidate.value.questions.length < preferences.value.count ? null : h('button', { type: 'button', class: 'quiet-button', onClick: requestExactCount }, 'Copy request to fit question limit'),
                correctionMessage.value ? h('p', { role: 'status' }, correctionMessage.value) : null,
                correctionFallback.value ? h('textarea', { readonly: true, rows: 3, value: countCorrection() }) : null,
              ]) : null,
          report.value && (report.value.issues.length || report.value.notices.length || report.value.recovered) ? h('details', {
            class: 'review-ai-warning-details',
          }, [
            h('summary', 'Response recovery details'),
            h('ul', [
              ...(report.value.recovered ? [report.value.recovered + ' question(s) recovered from the response.'] : []),
              ...report.value.notices,
              ...report.value.issues.map(issue => (issue.item ? 'Question ' + issue.item + ': ' : '') + issue.message),
            ].map(message => h('li', message))),
            report.value.issues.length ? h('button', { type: 'button', class: 'quiet-button', onClick: () => go('recovery') }, 'Fix remaining questions') : null,
          ]) : null,
          batchPrompt.value && report.value && (report.value.issues.length || report.value.notices.length || report.value.recovered)
            ? h('details', { class: 'review-ai-warning-details' }, [
              h('summary', 'Add another batch'),
              h('p', 'Keep these questions and bring back a smaller batch from the same AI conversation.'),
              h('button', { type: 'button', class: 'quiet-button', onClick: () => {
                if (report.value) {
                  batchOnly.value = true;
                  go('recovery');
                }
              } }, 'Get instructions for another batch'),
            ]) : null,
          candidate.value.warnings.length ? h('details', { class: 'review-ai-warning-details' }, [
            h('summary', 'Other things to review'),
            h('ul', candidate.value.warnings.map(w => h('li', w))),
          ]) : null,
          h('details', { class: 'review-ai-questions-details', open: true }, [
            h('summary', `Preview all ${candidate.value.questions.length} questions`),
            h('ol', { class: 'review-ai-preview' }, candidate.value.questions.map(reviewAiQuestionPreview)),
          ]),
          h('div', { class: 'study-ai-actions' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: back }, 'Back to response'),
            h('button', { type: 'button', class: 'card-primary-button',
              onClick: () => { if (candidate.value) emit('create', candidate.value); },
            }, `Create set with ${candidate.value.questions.length} questions`),
          ]),
        ]) : h(AiPromptExchange, {
          ref: exchange,
          preferFileImport: true,
          allowRawResponseFile: true,
          showReviewStep: stage.value !== 'direct',
          startInImport: stage.value === 'direct' || returningFromReview.value, importOnly: stage.value === 'direct', skipSource: Boolean(scope.value),
          idPrefix: 'review-ai', label: 'Review', prompt: prompt.value, json: json.value, problem: problem.value,
          maxLength: MAX_AI_IMPORT_LENGTH, hasPreview: false,
          promptHelp: stage.value === 'direct' ? 'Import an existing Review knowledge set.' : scope.value
            ? `Create questions for the selected category ${preferences.value.mixMode === 'ai' ? 'with AI-selected question types' : 'using your percentages'}.`
            : `Create questions covering the overall subject ${preferences.value.mixMode === 'ai' ? 'with an appropriate mix of question types' : 'using your percentages'}.`,
          validateLabel: 'Validate & continue',
          importHelp: adding.value && candidate.value
            ? `${candidate.value.questions.length} questions are safe. Bring back the AI’s new response to add to them.`
            : 'Choose the .json file from your AI conversation, or paste its response instead.',
          onUpdateJson: (value: string) => { json.value = value; problem.value = ''; correctionMessage.value = ''; correctionFallback.value = false; },
          onValidate: validate,
        }),
      ]);
    }
    return () => h('div', { class: ['ai-workflow', { 'is-backward': backward.value }] }, [
      h(Transition, { name: 'ai-workflow-step', mode: 'out-in', onAfterEnter: (element: Element) => element.querySelector<HTMLElement>('h2[tabindex]')?.focus({ preventScroll: true }) }, { default: workspace }),
    ]);
  },
});
