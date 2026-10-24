import { computed, defineComponent, h, onMounted, ref, Transition } from 'vue';
import { AiCategoryPicker } from '../../components/ai-category-picker.ts';
import { AiScopeChoices } from '../../components/ai-scope-choices.ts';
import { Icon } from '../../components/icon.ts';
import { AiPromptExchange, type AiPromptExchangeHandle } from '../../components/ai-prompt-exchange.ts';
import { MarkdownContent } from '../../components/markdown-content.ts';
import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import { DEFAULT_SESSION_QUESTION_LIMIT } from './set-options.ts';
import type { AiCardCategories, AiCardScope } from '../../core/ai-study-categories.ts';
import { inputValue } from '../../core/dom.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { parseReviewAiImport, reviewAiPrompt, type ReviewAiImport, type ReviewAiPreferences } from './ai-import-format.ts';

import { REVIEW_AI_FOCUSES } from './ai-focus.ts';
import { AI_QUESTION_TYPES, allocateQuestions, DEFAULT_AI_WEIGHTS, equalizeQuestionWeights, normalizeQuestionWeights, questionCountProblem, questionMixProblem, questionTypeLabel, rebalanceQuestionWeights, type QuestionWeights, type AiQuestionType } from './ai-question-mix.ts';
import { MAX_QUESTIONS, questionDisplayPrompt, type Question } from './question-model.ts';

export const ReviewAiCreation = defineComponent({
  name: 'ReviewAiCreation',
  props: { destination: { type: String, required: true } },
  emits: { cancel: () => true, create: (_value: ReviewAiImport) => true },
  setup(props, { emit }) {
    const stage = ref<'scope' | 'categories' | 'configure' | 'generate' | 'direct' | 'review'>('scope');
    const importedDirectly = ref(false);
    const returningFromReview = ref(false);
    const scope = ref<AiCardScope | null>(null);
    const categories = ref<AiCardCategories | null>(null);
    const preferences = ref<ReviewAiPreferences>({ count: 50, coverage: 'balanced', mixMode: 'ai', aiFocus: 'default', weights: { ...DEFAULT_AI_WEIGHTS } });
    const json = ref('');
    const problem = ref('');
    const candidate = ref<ReviewAiImport | null>(null);

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
      if (stage.value === 'review') { returningFromReview.value = true; go(importedDirectly.value ? 'direct' : 'generate', true); }
      else if ((stage.value === 'generate' || stage.value === 'direct') && exchange.value?.goBack()) return;
      else if (stage.value === 'direct') go('scope', true);
      else if (stage.value === 'generate') go('configure', true);
      else if (stage.value === 'configure') go(scope.value ? 'categories' : 'scope', true);
      else go('scope', true);
    }
    function validate() {
      candidate.value = null;

      validationRevision.value++;
      problem.value = '';
      try {
        candidate.value = parseReviewAiImport(json.value, preferences.value, { requireCoverage: stage.value !== 'direct' });
        importedDirectly.value = stage.value === 'direct';
        returningFromReview.value = false;
        go('review');
      }
      catch (error) { problem.value = error instanceof Error ? error.message : String(error); }
    }
    function countCorrection() {
      return `Return at most ${preferences.value.count} meaningful questions. Combine related concepts where useful; remove redundant questions without losing important distinctions. If the count prevents full coverage, identify the uncovered topics in confidence.uncoveredSubjects, adjust overallCoverage honestly, and return COMPLETE corrected JSON. Never exceed the requested question count.`;
    }
    function lowConfidencePrompt() {
      const result = candidate.value;
      if (!result?.confidence) return '';
      const c = result.confidence;
      const low = [
        ['Overall coverage', c.overallCoverage], ['Exam confidence', c.examConfidence],
        ['Subject confidence', c.subjectConfidence], ['Study confidence', c.studyConfidence],
      ].filter(([, value]) => Number(value) < 80).map(([name, value]) => name + ': ' + value + '%');
      const suggested = Math.min(MAX_QUESTIONS, Math.max(preferences.value.count + 10, Math.ceil(preferences.value.count * 1.5)));
      return 'Please improve the existing Dynamic Learner Review knowledge set using the original source. These AI-estimated scores fell below 80%: ' +
        low.join('; ') + '. Re-evaluate WHY each is low. If more questions would genuinely increase coverage or study value, regenerate up to ' +
        suggested + ' meaningful questions (never exceed this limit), including underrepresented subjects; preserve accurate existing material and avoid filler. ' +
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
              ? 'Choose how much of the material your questions should cover.'
              : scope.value?.category.description ?? 'Cover the overall subject using your chosen question-type strategy.'),
          ]),
          h('div', { class: 'study-ai-actions' }, [
            stage.value !== 'scope' ? h('button', { type: 'button', class: 'quiet-button', onClick: back }, 'Back') : null,
            stage.value !== 'scope' ? h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel') : null,
          ]),
        ]),
        stage.value === 'scope' ? [h(AiScopeChoices, {
          onOverall: () => { scope.value = null; go('configure'); },
          onCategory: () => go('categories'),
        }),
          h('div', { class: 'study-ai-actions ai-scope-actions' }, [
            h('button', { type: 'button', class: 'quiet-button outline-button', style: { width: 'auto', flex: '0 0 auto' }, onClick: () => { scope.value = null; go('direct'); } }, 'Import an AI response'),
            h('button', { type: 'button', class: 'quiet-button', style: { width: 'auto', flex: '0 0 auto' }, onClick: () => emit('cancel') }, 'Cancel'),
          ]),
        ] : stage.value === 'configure' ? [
          h('div', { class: 'review-ai-settings' }, [
            h('label', [h('span', 'Total questions'), h('input', { type: 'number', min: 1, max: MAX_QUESTIONS, step: 1, value: preferences.value.count,
              onInput: (event: Event) => { preferences.value.count = Number(inputValue(event)); } }), h('small', { class: 'study-ai-muted' }, 'Number of questions the AI should make.')]),
            h('label', [h('span', 'Coverage'), h('select', { value: preferences.value.coverage, onChange: (event: Event) => {
              const value = inputValue(event); if (value === 'essentials' || value === 'balanced' || value === 'comprehensive') preferences.value.coverage = value;
            } }, [h('option', { value: 'essentials' }, 'Essentials only'), h('option', { value: 'balanced' }, 'Balanced'), h('option', { value: 'comprehensive' }, 'Comprehensive')]), h('small', { class: 'study-ai-muted' }, 'Key facts, a balanced mix, or detailed coverage.')]),
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
          preferences.value.mixMode === 'ai' ? h('fieldset', { class: 'review-ai-focus' }, [
            h('legend', 'AI focus'),
            h('div', { class: 'review-ai-focus-options' }, REVIEW_AI_FOCUSES.map(option => h('label', {
              class: 'review-ai-focus-option', key: option.id,
            }, [
              h('input', {
                type: 'radio', name: 'review-ai-focus', value: option.id,
                checked: (preferences.value.aiFocus ?? 'default') === option.id,
                onChange: () => { preferences.value.aiFocus = option.id; },
              }),
              h(Icon, { name: option.icon }),
              h('span', { class: 'review-ai-focus-copy' }, [
                h('strong', option.label),
                h('span', option.description),
              ]),
            ]))),
          ]) : null,
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
        ] : stage.value === 'review' && candidate.value ? h('div', { class: 'review-ai-final' }, [
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
                ['Exam confidence', candidate.value.confidence.examConfidence],
                ['Subject confidence', candidate.value.confidence.subjectConfidence],
                ['Study confidence', candidate.value.confidence.studyConfidence],
              ] as const).map(([label, value]) => h('div', { class: 'review-ai-metric', key: label }, [
                h('div', [h('strong', label), h('span', value + '%')]),
                h('div', { class: 'review-ai-meter', role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0,
                  'aria-valuemax': 100, 'aria-valuenow': value }, [
                  h('span', { style: { width: value + '%' } }),
                ]),
              ])),
            ]),
            h('div', { class: 'review-ai-confidence-notes' }, [
              h('p', candidate.value.confidence.coverageExplanation),
              candidate.value.confidence.uncoveredSubjects.length
                ? h('div', [
                    h('strong', 'Potentially missing coverage'),
                    h('ul', candidate.value.confidence.uncoveredSubjects.map((subject, i) => h('li', { key: i }, subject))),
                  ]) : null,
              h('p', candidate.value.confidence.confidenceExplanation),
            ]),
          ]) : h('p', { class: 'study-ai-muted' }, 'This older imported JSON does not contain confidence statistics. Its coverage has not been assessed.'),
          candidate.value.confidence && [
            candidate.value.confidence.overallCoverage, candidate.value.confidence.examConfidence,
            candidate.value.confidence.subjectConfidence, candidate.value.confidence.studyConfidence,
          ].some(value => value < 80) ? h('section', { class: 'review-ai-difference', role: 'status' }, [
            h('strong', 'One or more confidence estimates are below 80%'),
            h('p', 'You can ask the AI to improve the set. It will suggest more questions when useful, or explain what additional source material is needed.'),
            !importedDirectly.value ? h('button', { type: 'button', class: 'card-primary-button', onClick: () => {
              returningFromReview.value = false;
              go('configure', true);
            } }, 'Increase question count') : null,
            h('button', { type: 'button', class: 'quiet-button', onClick: requestLowConfidence }, 'Copy improvement prompt'),
            correctionMessage.value ? h('p', { role: 'status' }, correctionMessage.value) : null,
            correctionFallback.value ? h('textarea', { readonly: true, rows: 5, value: lowConfidencePrompt(), 'aria-label': 'Confidence improvement prompt' }) : null,
          ]) : null,
                    h('h3', candidate.value.title),
          h('p', candidate.value.description),
          h('div', { class: 'review-ai-preview-counts', role: 'status' }, [
            !importedDirectly.value ? h('div', [h('strong', String(preferences.value.count)), h('span', 'Requested')]) : null,
            !importedDirectly.value ? h(Icon, { name: 'chevron' }) : null,
            h('div', [h('strong', String(candidate.value.questions.length)), h('span', 'Received from AI')]),
          ]),
          !importedDirectly.value && candidate.value.questions.length !== preferences.value.count
            ? h('section', { class: 'review-ai-difference', role: 'status' }, [
                h('strong', 'The AI did not follow the requested question count'),
                h('p', `Requested ${preferences.value.count}; received ${candidate.value.questions.length}. Dynamic Learner has not removed any questions. The new AI prompt enforces this limit; you can ask the AI to regenerate the response.`),
                h('button', { type: 'button', class: 'quiet-button', onClick: requestExactCount }, 'Copy request to fit question limit'),
                correctionMessage.value ? h('p', { role: 'status' }, correctionMessage.value) : null,
                correctionFallback.value ? h('textarea', { readonly: true, rows: 3, value: countCorrection() }) : null,
              ]) : null,
          candidate.value.warnings.length ? h('details', { class: 'review-ai-warning-details' }, [
            h('summary', 'Other things to review'),
            h('ul', candidate.value.warnings.map(w => h('li', w))),
          ]) : null,
          h('details', { class: 'review-ai-questions-details', open: true }, [
            h('summary', `Preview all ${candidate.value.questions.length} questions`),
            h('ol', { class: 'review-ai-preview' }, candidate.value.questions.map(previewQuestion)),
          ]),
          h('div', { class: 'study-ai-actions' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: back }, 'Back to JSON'),
            h('button', { type: 'button', class: 'card-primary-button',
              onClick: () => { if (candidate.value) emit('create', candidate.value); },
            }, `Create set with ${candidate.value.questions.length} questions`),
          ]),
        ]) : h(AiPromptExchange, {
          ref: exchange,
          showReviewStep: stage.value !== 'direct',
          startInImport: stage.value === 'direct' || returningFromReview.value, importOnly: stage.value === 'direct', skipSource: Boolean(scope.value),
          idPrefix: 'review-ai', label: 'Review', prompt: prompt.value, json: json.value, problem: problem.value,
          maxLength: MAX_AI_IMPORT_LENGTH, hasPreview: false,
          promptHelp: stage.value === 'direct' ? 'Import an existing Review knowledge set.' : scope.value
            ? `Create questions for the selected category ${preferences.value.mixMode === 'ai' ? 'with AI-selected question types' : 'using your percentages'}.`
            : `Create questions covering the overall subject ${preferences.value.mixMode === 'ai' ? 'with an appropriate mix of question types' : 'using your percentages'}.`,
          validateLabel: 'Continue to Step 5 · Review',
          importHelp: 'Paste the generated JSON, then continue to the separate review step.',
          onUpdateJson: (value: string) => { json.value = value; candidate.value = null; problem.value = ''; correctionMessage.value = ''; correctionFallback.value = false; },
          onValidate: validate,
        }),
      ]);
    }
    return () => h('div', { class: ['ai-workflow', { 'is-backward': backward.value }] }, [
      h(Transition, { name: 'ai-workflow-step', mode: 'out-in', onAfterEnter: (element: Element) => element.querySelector<HTMLElement>('h2[tabindex]')?.focus({ preventScroll: true }) }, { default: workspace }),
    ]);
  },
});
