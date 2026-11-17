import { computed, defineComponent, h, nextTick, onBeforeUnmount, ref, watch, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { MarkdownContent } from '../../components/markdown-content.ts';
import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import { inputValue } from '../../core/dom.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import type { ReviewAiImport, ReviewAiPreferences } from './ai-import-format.ts';
import { recoverReviewResponse, repairReviewPrompt, type ReviewResponseRecovery } from './ai-response-recovery.ts';
import { questionTypeLabel } from './ai-question-mix.ts';
import { questionDisplayPrompt, validateQuestions, type Question } from './question-model.ts';

function fingerprint(question: Question): string {
  // Do not merge distinct questions simply because their wording is the same.
  const { id: _id, shownCount: _shownCount, ...content } = question;
  return JSON.stringify(content);
}

function previewQuestion(question: Question, index: number) {
  const answers = question.type === 'parameterized'
    ? (question.parameters?.rules.answers ?? []).map(answer => answer.label + ': ' + (answer.expression ?? 'Solver output ' + answer.solverKey))
    : question.type === 'dropdown' ? (question.matches ?? []).map(row => row.label + ': ' + row.answer)
    : question.type === 'fill-in-the-blanks' ? parseFillBlankTemplate(question.prompt).answers
    : question.correctAnswers ?? [question.answer];
  return h('li', { key: question.id }, [
    h('span', { class: 'study-ai-muted' }, (index + 1) + ' · ' + questionTypeLabel(question.type)),
    h('strong', questionDisplayPrompt(question)),
    question.context?.trim() ? h(MarkdownContent, { text: question.context, class: 'knowledge-question-context' }) : null,
    question.choices.length ? h('ul', question.choices.map(choice => h('li', choice))) : null,
    question.parameters?.rules.solver?.package ? h('p', { class: 'study-ai-muted' }, 'Includes AI-generated solver code. It runs only when a generated variant is used.') : null,
    question.type !== 'statement' ? h('details', [
      h('summary', 'Reveal answer'), h('p', answers.join(' · ')),
      question.explanation ? h('p', question.explanation) : null,
    ]) : null,
  ]);
}

export type ReviewAiStep = 'generate' | 'response' | 'result';

export function reviewAiProgress(current: 'setup' | ReviewAiStep) {
  const steps = [
    { id: 'setup', label: 'Set up' },
    { id: 'generate', label: 'Generate' },
    { id: 'response', label: 'Import' },
    { id: 'result', label: 'Finish' },
  ] as const;
  return h('div', { class: 'review-ai-progress', 'aria-label': 'AI creation progress' }, [
    h('span', { class: 'study-ai-muted' }, 'Step ' + (steps.findIndex(step => step.id === current) + 1) + ' of ' + steps.length),
    h('ol', steps.map(step => h('li', { key: step.id, class: step.id === current ? 'is-active' : '',
      'aria-current': step.id === current ? 'step' : undefined }, step.label))),
  ]);
}

/** Review-only handoff: keep the accepted draft independent of the next incoming response. */
export const ReviewAiResponseWorkspace = defineComponent({
  name: 'ReviewAiResponseWorkspace',
  props: {
    preferences: { type: Object as PropType<ReviewAiPreferences>, required: true },
    prompt: { type: String, required: true },
    promptForCount: { type: Function as PropType<(count: number) => string>, required: true },
    step: { type: String as PropType<ReviewAiStep>, required: true },
    appendMode: Boolean,
    existing: { type: Array as PropType<Question[]>, default: () => [] },
  },
  emits: { complete: (_value: ReviewAiImport) => true, step: (_step: ReviewAiStep) => true, back: () => true },
  setup(props, { emit }) {
    const raw = ref('');
    const candidate = ref<ReviewAiImport | null>(null);
    const report = ref<ReviewResponseRecovery | null>(null);
    const notices = ref<string[]>([]);
    const copyStatus = ref('');
    const copyContext = ref<'generate' | 'repair' | 'ready'>('generate');
    const fallback = ref('');
    watch(() => props.prompt, () => { copyStatus.value = ''; fallback.value = ''; });
    const inputStatus = ref('');
    const fileInput = ref<HTMLInputElement | null>(null);
    const preview = ref<HTMLElement | null>(null);
    const recovery = ref<HTMLElement | null>(null);
    const activePanel = ref<HTMLElement | null>(null);
    watch(() => props.step, () => { void nextTick(() => activePanel.value?.focus()); });
    const dragging = ref(false);
    const reading = ref(false);
    let fileRevision = 0;
    onBeforeUnmount(() => { fileRevision++; });
    const remaining = computed(() => Math.max(0, props.preferences.count - (candidate.value?.questions.length ?? 0)));
    const repairPrompt = computed(() => report.value?.issues.length
      ? repairReviewPrompt(report.value.issues, Math.max(1, remaining.value || report.value.issues.length)) : '');
    const nextBatchPrompt = computed(() => {
      const count = Math.min(25, remaining.value);
      if (!count || !props.prompt) return '';
      const previous = [...props.existing, ...(candidate.value?.questions ?? [])];
      const avoid = previous.map(question => questionDisplayPrompt(question).replace(/\s+/g, ' ').slice(0, 200)).join('\n');
      return props.promptForCount(count) + (avoid ? '\n\nThis is an additional batch. Return ONLY new questions not already assessed by these existing prompts. Do not regenerate the existing set:\n' + avoid : '');
    });

    async function copy(text: string, label: string, context: typeof copyContext.value = 'generate') {
      if (!text) return;
      copyContext.value = context;
      fallback.value = '';
      copyStatus.value = '';
      try {
        await navigator.clipboard.writeText(text);
        copyStatus.value = label + ' copied. Send them in your AI chat, then return here with the response.';
      } catch {
        fallback.value = text;
        copyStatus.value = 'Copying was blocked. Select and copy the text below.';
      }
    }

    function showResult(hasIssues: boolean) {
      emit('step', 'result');
      void nextTick(() => (hasIssues && !candidate.value ? recovery.value : preview.value)?.focus());
    }

    function copyFeedback(context: typeof copyContext.value) {
      if (copyContext.value !== context || !copyStatus.value) return null;
      return h('div', { class: 'review-ai-copy-feedback' }, [
        h('p', { role: 'status', class: 'review-ai-copy-status' }, copyStatus.value),
        fallback.value ? h('textarea', { rows: 5, readonly: true, value: fallback.value, 'aria-label': 'Instructions to copy' }) : null,
      ]);
    }

    function check(text: string, append: boolean) {
      inputStatus.value = '';
      copyStatus.value = '';
      fallback.value = '';
      report.value = recoverReviewResponse(text, props.preferences);
      const incoming = report.value.candidate;
      if (!incoming) {
        inputStatus.value = candidate.value ? 'No new questions were ready. Your existing draft is unchanged.' : 'No questions are ready yet. See the suggested fix below.';
        showResult(true);
        return;
      }
      try {
        const old = append ? candidate.value : null;
        const seen = new Set([...props.existing, ...(old?.questions ?? [])].map(fingerprint));
        const fresh = incoming.questions.filter(question => {
          const key = fingerprint(question);
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
        const duplicateCount = incoming.questions.length - fresh.length;
        if (!fresh.length) {
          inputStatus.value = 'This response contains no new questions. Your draft is unchanged.';
          showResult(report.value.issues.length > 0);
          return;
        }
        const questions = [...(old?.questions ?? []), ...fresh];
        validateQuestions(questions);
        const warnings = [
          ...incoming.warnings.filter(warning => !warning.startsWith('Requested ')),
          ...(duplicateCount ? [duplicateCount + ' duplicate questions were skipped.'] : []),
          ...(questions.length !== props.preferences.count ? ['Requested ' + props.preferences.count + '; ' + questions.length + ' questions are ready.'] : []),
        ];
        candidate.value = {
          ...incoming, title: old?.title ?? incoming.title, description: old?.description ?? incoming.description,
          questions, warnings,
          // An AI summary describes its original response, not a merged or deduplicated set.
          confidence: old || duplicateCount ? null : incoming.confidence,
          coverage: old || duplicateCount ? null : incoming.coverage,
        };
        notices.value = [
          ...(old ? notices.value : []), ...report.value.notices,
          ...(old && (old.confidence || incoming.confidence) ? ['Confidence estimates are not combined across batches.'] : []),
          ...(duplicateCount ? [duplicateCount + ' duplicate questions were skipped.'] : []),
          ...(report.value.issues.length ? [report.value.issues.length + ' item(s) from this response could not be imported.'] : []),
        ];
        raw.value = '';
        inputStatus.value = fresh.length + (fresh.length === 1 ? ' question' : ' questions') + (old ? ' added.' : ' ready.');
        showResult(report.value.issues.length > 0);
      } catch (error) {
        inputStatus.value = error instanceof Error ? error.message : String(error);
      }
    }

    function updateRaw(text: string) {
      fileRevision++;
      reading.value = false;
      raw.value = text.slice(0, MAX_AI_IMPORT_LENGTH + 1);
      inputStatus.value = '';
      if (text.length > MAX_AI_IMPORT_LENGTH) inputStatus.value = 'This response is too large. Ask for a smaller batch.';
    }

    async function acceptFile(file: File | undefined) {
      if (!file) return;
      const revision = ++fileRevision;
      reading.value = true;
      inputStatus.value = '';
      try {
        if (file.size > MAX_AI_IMPORT_LENGTH * 4) throw new Error('This file is too large. Ask for a smaller batch.');
        const text = await file.text();
        if (revision !== fileRevision) return;
        if (text.length > MAX_AI_IMPORT_LENGTH) throw new Error('This file is too large. Ask for a smaller batch.');
        raw.value = text;
        if (!candidate.value) check(text, false);
        else inputStatus.value = 'File loaded. Select Add questions to draft to keep your collected questions.';
      } catch (error) {
        if (revision === fileRevision) inputStatus.value = error instanceof Error ? error.message : String(error);
      } finally {
        if (revision === fileRevision) reading.value = false;
      }
    }

    function button(label: string, action: () => void, primary = false, disabled = false) {
      return h('button', { type: 'button', class: primary ? 'card-primary-button' : 'quiet-button', disabled, onClick: action }, label);
    }

    function goToResponse() {
      // A failed reply can remain in the input for inspection, but the next
      // response should have a clean field so it cannot accidentally be appended.
      updateRaw('');
      emit('step', 'response');
    }

    function backFromResponse() {
      if (candidate.value) emit('step', 'result');
      else emit('step', 'generate');
    }

    return () => h('div', { class: 'review-ai-exchange' }, props.step === 'generate' ? [
      h('section', { class: 'review-ai-panel', ref: activePanel, tabindex: -1 }, [
        h('h3', 'Send your instructions to AI'),
        h('p', 'Copy the instructions below. Open your AI chat, attach your study material, and send the instructions with it. If your notes are already in the chat, use that same conversation.'),
        h('p', { class: 'study-ai-muted' }, 'Requested: ' + props.preferences.count + ' questions.'),
        h('div', { class: 'review-ai-inline-actions' }, [
          button('Copy instructions', () => { void copy(props.prompt, 'Instructions'); }, true, !props.prompt),
          h('a', { class: 'quiet-button', href: 'https://chatgpt.com/', target: '_blank', rel: 'noopener noreferrer',
            onClick: () => { if (copyContext.value === 'generate' && copyStatus.value && !fallback.value) emit('step', 'response'); } }, [h(Icon, { name: 'ai' }), 'Open ChatGPT']),
        ]),
        copyFeedback('generate'),
        nextBatchPrompt.value && remaining.value > 25 ? h('details', { class: 'review-ai-secondary-details' }, [
          h('summary', 'Other generation options'),
          nextBatchPrompt.value && remaining.value > 25 ? h('p', { class: 'study-ai-muted' }, 'If your AI struggles with a large request, generate up to 25 questions at a time.') : null,
          nextBatchPrompt.value && remaining.value > 25 ? button('Copy smaller batch (up to 25)', () => { void copy(nextBatchPrompt.value, 'Batch instructions'); }) : null,
        ]) : null,
        h('details', { class: 'review-ai-secondary-details' }, [
          h('summary', 'View instructions'),
          h('textarea', { readonly: true, rows: 5, value: props.prompt, 'aria-label': 'AI generation instructions' }),
        ]),
        h('div', { class: 'review-ai-inline-actions review-ai-navigation' }, [
          button('Back', () => emit('back')),
          button('I have the response', () => emit('step', 'response'), true),
        ]),
      ]),
    ] : props.step === 'response' ? [
      h('section', { class: 'review-ai-panel', ref: activePanel, tabindex: -1 }, [
        h('h3', 'Bring the response back'),
        h('p', { class: 'study-ai-muted' }, candidate.value
          ? candidate.value.questions.length + ' questions are already ready. Add another response without losing them.'
          : 'Upload the file your AI created, or copy and paste its entire response. We’ll check it and recover what we can.'),
        h('div', {
          class: ['review-ai-drop', { 'is-dragging': dragging.value }],
          onDragover: (event: DragEvent) => { event.preventDefault(); dragging.value = true; },
          onDragleave: () => { dragging.value = false; },
          onDrop: (event: DragEvent) => {
            event.preventDefault(); dragging.value = false; void acceptFile(event.dataTransfer?.files[0]);
          },
        }, [
          h(Icon, { name: 'upload' }),
          h('input', { ref: fileInput, type: 'file', accept: '.json,.txt,.md,application/json,text/plain,text/markdown', class: 'visually-hidden',
            'aria-label': 'Upload AI response file', tabindex: -1, onChange: (event: Event) => {
              const target = event.target as HTMLInputElement;
              void acceptFile(target.files?.[0]); target.value = '';
            } }),
          button(reading.value ? 'Reading file…' : 'Choose response file', () => fileInput.value?.click(), false, reading.value),
          h('span', { class: 'study-ai-muted' }, 'or drop a file here'),
        ]),
        h('textarea', {
          rows: 5, value: raw.value, maxlength: MAX_AI_IMPORT_LENGTH + 1, placeholder: 'Paste the AI’s response here…',
          'aria-label': 'AI response', onInput: (event: Event) => updateRaw(inputValue(event)),
          onPaste: (event: ClipboardEvent) => {
            const text = event.clipboardData?.getData('text/plain');
            if (!text || candidate.value || raw.value.trim()) return;
            event.preventDefault(); updateRaw(text); check(raw.value, false);
          },
        }),
        h('div', { class: 'review-ai-inline-actions' }, [
          button(candidate.value ? 'Add questions to draft' : 'Check response', () => check(raw.value, Boolean(candidate.value)), true, reading.value || !raw.value.trim()),
          raw.value ? button('Clear response', () => updateRaw('')) : null,
        ]),
        inputStatus.value ? h('p', { role: 'status', class: 'study-ai-muted' }, inputStatus.value) : null,
        candidate.value && raw.value.trim() ? h('details', { class: 'review-ai-secondary-details' }, [
          h('summary', 'Replace instead of adding'),
          h('p', { class: 'study-ai-muted' }, 'A valid new response will replace the collected draft. Your existing saved knowledge sets are unaffected.'),
          button('Replace draft with response', () => check(raw.value, false), false, reading.value),
        ]) : null,
        h('div', { class: 'review-ai-inline-actions review-ai-navigation' }, [
          button('Back', backFromResponse),
        ]),
      ]),
    ] : [
      inputStatus.value ? h('p', { role: 'status', class: 'study-ai-muted' }, inputStatus.value) : null,
      report.value?.issues.length && !candidate.value ? h('section', { class: 'review-ai-panel review-ai-recovery', 'aria-label': 'Response recovery', ref: recovery, tabindex: -1 }, [
        h('h3', 'The AI response needs a correction'),
        h('p', 'Copy a correction request and send it in the same AI chat. You can also try a smaller batch.'),
        h('div', { class: 'review-ai-inline-actions' }, [
          button('Copy repair instructions', () => { void copy(repairPrompt.value, 'Repair instructions', 'repair'); }, true),
          nextBatchPrompt.value ? button('Copy smaller request', () => { void copy(nextBatchPrompt.value, 'Batch instructions', 'repair'); }) : null,
        ]),
        copyFeedback('repair'),
        h('div', { class: 'review-ai-inline-actions review-ai-navigation' }, [
          button('Back to response', () => emit('step', 'response')),
          button('I have the corrected response', goToResponse, true),
        ]),
        h('details', { class: 'review-ai-secondary-details' }, [
          h('summary', 'See what could not be read (' + report.value.issues.length + ')'),
          h('ul', report.value.issues.map((issue, index) => h('li', { key: index }, (issue.item ? 'Question ' + issue.item + ': ' : '') + issue.message))),
        ]),
      ]) : null,
      candidate.value ? h('section', { class: 'review-ai-panel review-ai-ready', ref: preview, tabindex: -1, 'aria-label': 'Ready questions' }, [
        h('h3', 'Your questions are ready'),
        h('div', { class: 'review-ai-ready-count', role: 'status' }, [
          h('strong', String(candidate.value.questions.length)), h('span', 'questions ready'),
          report.value?.recovered ? h('small', report.value.recovered + ' recovered from the latest response') : null,
        ]),
        h('p', { class: 'study-ai-muted' }, 'Requested ' + props.preferences.count + '. Valid format does not guarantee factual accuracy.'),
        !props.appendMode ? h('label', { class: 'review-ai-name' }, [
          h('span', 'Knowledge set name'),
          h('input', { value: candidate.value.title, maxlength: 120, onInput: (event: Event) => { if (candidate.value) candidate.value.title = inputValue(event); } }),
        ]) : null,
        candidate.value.description ? h('p', { class: 'study-ai-muted' }, candidate.value.description) : null,
        h('div', { class: 'review-ai-inline-actions' }, [
          button((props.appendMode ? 'Add ' : 'Create set with ') + candidate.value.questions.length + ' questions',
            () => { if (candidate.value) emit('complete', candidate.value); }, true, !candidate.value.title.trim()),
        ]),
        report.value?.issues.length ? h('section', { class: 'review-ai-recovery review-ai-repair-summary', 'aria-label': 'Response recovery' }, [
          h('strong', report.value.issues.length + ' item(s) could not be read'),
          h('p', { class: 'study-ai-muted' }, 'You can create your set now or ask the AI to correct just those items. The ready questions will be kept.'),
          button('Copy repair instructions', () => { void copy(repairPrompt.value, 'Repair instructions', 'repair'); }),
          copyFeedback('repair'),
          copyContext.value === 'repair' && copyStatus.value ? button('I have the corrected response', goToResponse, true) : null,
          h('details', { class: 'review-ai-secondary-details' }, [
            h('summary', 'See what went wrong'),
            h('ul', report.value.issues.map((issue, index) => h('li', { key: index }, (issue.item ? 'Question ' + issue.item + ': ' : '') + issue.message))),
          ]),
        ]) : null,
        h('details', { class: 'review-ai-secondary-details' }, [
          h('summary', 'Add more questions'),
          h('div', { class: 'review-ai-advanced' }, [
            nextBatchPrompt.value ? button('Copy next batch', () => { void copy(nextBatchPrompt.value, 'Batch instructions', 'ready'); }) : null,
            copyFeedback('ready'),
            button('Bring another response', goToResponse),
          ]),
        ]),
        h('details', { class: 'review-ai-questions-details' }, [
          h('summary', 'Preview all ' + candidate.value.questions.length + ' questions'),
          h('ol', { class: 'review-ai-preview' }, candidate.value.questions.map(previewQuestion)),
        ]),
        candidate.value.confidence ? h('details', { class: 'review-ai-secondary-details' }, [
          h('summary', 'AI coverage and confidence estimates'),
          h('p', { class: 'study-ai-muted' }, 'These are the AI’s subjective estimates, not measured probabilities or a guarantee of exam success.'),
          h('ul', [
            h('li', 'Overall coverage: ' + candidate.value.confidence.overallCoverage + '%'),
            h('li', 'Exam confidence: ' + candidate.value.confidence.examConfidence + '%'),
            h('li', 'Subject confidence: ' + candidate.value.confidence.subjectConfidence + '%'),
            h('li', 'Study confidence: ' + candidate.value.confidence.studyConfidence + '%'),
          ]),
          h('p', candidate.value.confidence.coverageExplanation),
          h('p', candidate.value.confidence.confidenceExplanation),
          candidate.value.confidence.uncoveredSubjects.length ? h('ul', candidate.value.confidence.uncoveredSubjects.map(subject => h('li', subject))) : null,
        ]) : h('p', { class: 'study-ai-muted' }, 'Coverage and confidence estimates are unavailable for this draft.'),
        notices.value.length || candidate.value.warnings.length ? h('details', { class: 'review-ai-secondary-details' }, [
          h('summary', 'Import notes'),
          h('ul', [...new Set([...notices.value, ...candidate.value.warnings])].map(note => h('li', note))),
        ]) : null,
        h('div', { class: 'review-ai-inline-actions review-ai-navigation' }, [
          button('Back to response', () => emit('step', 'response')),
        ]),
      ]) : null,
    ]);
  },
});
