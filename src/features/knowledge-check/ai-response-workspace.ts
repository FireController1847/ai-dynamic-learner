import { computed, defineComponent, h, onBeforeUnmount, ref, type PropType } from 'vue';
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

/** Review-only handoff: keep the accepted draft independent of the next incoming response. */
export const ReviewAiResponseWorkspace = defineComponent({
  name: 'ReviewAiResponseWorkspace',
  props: {
    preferences: { type: Object as PropType<ReviewAiPreferences>, required: true },
    prompt: { type: String, required: true },
    promptForCount: { type: Function as PropType<(count: number) => string>, required: true },
    appendMode: Boolean,
    existing: { type: Array as PropType<Question[]>, default: () => [] },
  },
  emits: { complete: (_value: ReviewAiImport) => true },
  setup(props, { emit }) {
    const raw = ref('');
    const candidate = ref<ReviewAiImport | null>(null);
    const report = ref<ReviewResponseRecovery | null>(null);
    const notices = ref<string[]>([]);
    const copyStatus = ref('');
    const fallback = ref('');
    const inputStatus = ref('');
    const fileInput = ref<HTMLInputElement | null>(null);
    const preview = ref<HTMLElement | null>(null);
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

    async function copy(text: string, label: string) {
      if (!text) return;
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

    function check(text: string, append: boolean) {
      inputStatus.value = '';
      report.value = recoverReviewResponse(text, props.preferences);
      const incoming = report.value.candidate;
      if (!incoming) {
        inputStatus.value = candidate.value ? 'No new questions were ready. Your existing draft is unchanged.' : 'No questions are ready yet. See the suggested fix below.';
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
        inputStatus.value = fresh.length + (fresh.length === 1 ? ' question added.' : ' questions added.');
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
        else inputStatus.value = 'File loaded. Choose whether to add its questions or replace your draft.';
      } catch (error) {
        if (revision === fileRevision) inputStatus.value = error instanceof Error ? error.message : String(error);
      } finally {
        if (revision === fileRevision) reading.value = false;
      }
    }

    function button(label: string, action: () => void, primary = false, disabled = false) {
      return h('button', { type: 'button', class: primary ? 'card-primary-button' : 'quiet-button', disabled, onClick: action }, label);
    }

    return () => h('div', { class: 'review-ai-exchange' }, [
      h('section', { class: 'review-ai-panel' }, [
        h('div', { class: 'review-ai-panel-title' }, [h('span', { class: 'review-ai-step-number' }, '1'), h('h3', 'Generate in your AI chat')]),
        h('p', { class: 'study-ai-muted' }, 'Copy the instructions, open ChatGPT (or another AI), attach your study material, and send them together. You can also use a chat that already contains your notes.'),
        h('div', { class: 'review-ai-inline-actions' }, [
          button('Copy instructions', () => { void copy(props.prompt, 'Instructions'); }, true, !props.prompt),
          h('a', { class: 'quiet-button', href: 'https://chatgpt.com/', target: '_blank', rel: 'noopener noreferrer' }, [h(Icon, { name: 'ai' }), 'Open ChatGPT']),
          nextBatchPrompt.value ? button(candidate.value ? 'Copy next batch' : 'Copy smaller batch (up to 25)', () => { void copy(nextBatchPrompt.value, 'Batch instructions'); }) : null,
        ]),
        h('details', { class: 'review-ai-secondary-details' }, [
          h('summary', 'View instructions'),
          h('textarea', { readonly: true, rows: 5, value: props.prompt, 'aria-label': 'AI generation instructions' }),
        ]),
        h('p', { class: 'study-ai-muted' }, 'If the AI cannot make a downloadable file, its text response works too. No need to edit or understand JSON.'),
      ]),
      h('section', { class: 'review-ai-panel' }, [
        h('div', { class: 'review-ai-panel-title' }, [h('span', { class: 'review-ai-step-number' }, '2'), h('h3', 'Bring the response back')]),
        h('p', { class: 'study-ai-muted' }, candidate.value
          ? 'Paste another response to add more questions, or replace the draft if you want to start over.'
          : 'Upload the AI’s file or copy its entire response and paste it below. We’ll check it and recover what we can.'),
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
          candidate.value ? button('Replace draft with response', () => check(raw.value, false), false, reading.value || !raw.value.trim()) : null,
        ]),
        inputStatus.value ? h('p', { role: 'status', class: 'study-ai-muted' }, inputStatus.value) : null,
      ]),
      report.value?.issues.length ? h('section', { class: 'review-ai-panel review-ai-recovery', 'aria-label': 'Response recovery' }, [
        h('h3', candidate.value ? 'Some of the response needs attention' : 'The AI response needs a correction'),
        h('p', candidate.value ? 'Your ready questions are safe. Ask the AI to fix just the unresolved items, or continue with your draft.' : 'Copy a correction request and send it in the same AI chat. You can also try a smaller batch.'),
        h('div', { class: 'review-ai-inline-actions' }, [
          button('Copy repair instructions', () => { void copy(repairPrompt.value, 'Repair instructions'); }, true),
          nextBatchPrompt.value ? button('Copy smaller request', () => { void copy(nextBatchPrompt.value, 'Batch instructions'); }) : null,
        ]),
        h('details', { class: 'review-ai-secondary-details' }, [
          h('summary', 'See what could not be read (' + report.value.issues.length + ')'),
          h('ul', report.value.issues.map((issue, index) => h('li', { key: index }, (issue.item ? 'Question ' + issue.item + ': ' : '') + issue.message))),
        ]),
      ]) : null,
      copyStatus.value ? h('p', { role: 'status', class: 'review-ai-copy-status' }, copyStatus.value) : null,
      fallback.value ? h('textarea', { rows: 5, readonly: true, value: fallback.value, 'aria-label': 'Instructions to copy' }) : null,
      candidate.value ? h('section', { class: 'review-ai-panel review-ai-ready', ref: preview, 'aria-label': 'Ready questions' }, [
        h('div', { class: 'review-ai-panel-title' }, [h('span', { class: 'review-ai-step-number' }, '3'), h('h3', 'Your questions are ready')]),
        h('div', { class: 'review-ai-ready-count', role: 'status' }, [
          h('strong', String(candidate.value.questions.length)), h('span', 'questions ready'),
          report.value?.recovered ? h('small', report.value.recovered + ' recovered from the latest response') : null,
        ]),
        h('p', { class: 'study-ai-muted' }, 'Requested ' + props.preferences.count + '. You can finish now or add another response. Valid format does not guarantee factual accuracy.'),
        !props.appendMode ? h('label', { class: 'review-ai-name' }, [
          h('span', 'Knowledge set name'),
          h('input', { value: candidate.value.title, maxlength: 120, onInput: (event: Event) => { if (candidate.value) candidate.value.title = inputValue(event); } }),
        ]) : null,
        candidate.value.description ? h('p', { class: 'study-ai-muted' }, candidate.value.description) : null,
        h('div', { class: 'review-ai-inline-actions' }, [
          button((props.appendMode ? 'Add ' : 'Create set with ') + candidate.value.questions.length + ' questions',
            () => { if (candidate.value) emit('complete', candidate.value); }, true, !candidate.value.title.trim()),
          nextBatchPrompt.value ? button('Copy next batch', () => { void copy(nextBatchPrompt.value, 'Batch instructions'); }) : null,
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
      ]) : null,
    ]);
  },
});
