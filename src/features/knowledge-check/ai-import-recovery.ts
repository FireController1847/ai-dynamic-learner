import { defineComponent, h, ref, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { parseReviewAiImport, parseReviewQuestionsImport, type ReviewAiImport, type ReviewAiPreferences } from './ai-import-format.ts';
import { recoverReviewResponse, repairReviewPrompt, type ReviewResponseRecovery } from './ai-response-recovery.ts';
import { questionDisplayPrompt, validateQuestions, type Question } from './question-model.ts';

function fingerprint(question: Question): string {
  const { id: _id, shownCount: _shownCount, ...content } = question;
  return JSON.stringify(content);
}

/** Strict parsing is still the normal path. Recover only when the original parser rejects a response. */
export function checkReviewResponse(text: string, preferences: ReviewAiPreferences,
  options: { direct?: boolean; append?: boolean; previous?: ReviewAiImport | null; add?: boolean; existing?: Question[] } = {},
): ReviewResponseRecovery {
  let report: ReviewResponseRecovery;
  try {
    const candidate = options.append
      ? parseReviewQuestionsImport(text, preferences.count)
      : parseReviewAiImport(text, preferences, { requireCoverage: !options.direct && !options.add });
    report = { candidate, issues: [], received: candidate.questions.length, recovered: 0, notices: [] };
  } catch {
    report = recoverReviewResponse(text, preferences);
  }
  const incoming = report.candidate;
  if (incoming && !incoming.confidence && !options.direct && !options.append && !options.add &&
      !report.notices.some(notice => notice.includes('confidence'))) {
    report.notices.push('The AI did not provide confidence estimates. Your valid questions can still be used.');
  }
  if (!incoming) return { ...report, candidate: options.previous ?? null };
  const previous = options.add ? options.previous : null;
  if (!previous && !options.existing?.length) return report;
  const seen = new Set([...(options.existing ?? []), ...(previous?.questions ?? [])].map(fingerprint));
  const fresh = incoming.questions.filter(question => {
    const key = fingerprint(question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const duplicates = incoming.questions.length - fresh.length;
  if (duplicates) report.notices.push(duplicates + ' duplicate question(s) were skipped.');
  if (!fresh.length) {
    report.issues.push({ message: 'The reply did not contain any new questions.' });
    return { ...report, candidate: options.previous ?? null };
  }
  const questions = [...(previous?.questions ?? []), ...fresh];
  try { validateQuestions(questions); }
  catch {
    report.issues.push({ message: 'The new questions could not be combined with the draft.' });
    return { ...report, candidate: options.previous ?? null };
  }
  return {
    ...report,
    candidate: {
      ...incoming, title: previous?.title ?? incoming.title, description: previous?.description ?? incoming.description,
      questions,
      warnings: previous ? ['Requested ' + preferences.count + ' questions; ' + questions.length + ' are ready.'] : incoming.warnings,
      confidence: previous || duplicates ? null : incoming.confidence,
      coverage: previous || duplicates ? null : incoming.coverage,
    },
    notices: [...report.notices, ...(previous ? ['AI confidence estimates cannot be combined across responses.'] : [])],
  };
}

export function reviewRetryPrompt(report: ReviewResponseRecovery, count: number, accepted: number): string {
  if (accepted) return repairReviewPrompt(report.issues, Math.max(1, report.issues.filter(issue => issue.item !== undefined).length || count - accepted));
  return 'Please fix your previous Dynamic Learner Review response using the original study material and the instructions I already sent. ' +
    'Return the COMPLETE valid Review version-1 JSON response, preferably as a downloadable .json file. ' +
    'If you cannot attach a file, return the complete JSON as text. Do not omit any required question fields. ' +
    'Check the JSON syntax and do not invent facts or answers. Return only the response. ' +
    'The importer reported: ' + report.issues.map(issue => issue.message).join('; ').slice(0, 2000);
}

export function reviewBatchPrompt(prompt: string, questions: readonly Question[]): string {
  const prompts = questions.map(question => questionDisplayPrompt(question).replace(/\s+/g, ' ').slice(0, 200)).join('\n');
  return prompt + (prompts ? '\n\nReturn ONLY new questions. Do not repeat or paraphrase these already accepted question prompts:\n' + prompts : '');
}

/** A separate guided repair step, never shown during a successful ordinary import. */
export const ReviewAiRecoveryHelp = defineComponent({
  name: 'ReviewAiRecoveryHelp',
  props: {
    report: { type: Object as PropType<ReviewResponseRecovery>, required: true },
    accepted: { type: Number, required: true },
    repairPrompt: { type: String, required: true },
    batchPrompt: { type: String, default: '' },
    batchOnly: Boolean,
  },
  emits: { retry: () => true, review: () => true, back: () => true },
  setup(props, { emit }) {
    const copied = ref(false);
    const fallback = ref('');
    const copying = ref(false);
    async function copy(text: string) {
      copying.value = true;
      try { await navigator.clipboard.writeText(text); copied.value = true; fallback.value = ''; }
      catch { fallback.value = text; }
      finally { copying.value = false; }
    }
    return () => h('section', { class: 'review-ai-repair-step', 'aria-label': 'Recover your AI response' }, [
      h('h3', props.batchOnly ? 'Add more questions' : props.accepted ? props.accepted + ' questions are ready!' : 'Your AI response needs a quick fix'),
      h('p', props.batchOnly ? 'Keep your existing questions and ask the AI for another small batch.' : props.accepted
        ? 'We kept the questions that could be read. Some of the response could not be used, but you do not need to start over.'
        : 'We couldn’t read the response yet. This can happen when the AI sends an incomplete or incorrectly formatted reply. You don’t need to fix it yourself.'),
      copied.value ? [
        h('div', { class: 'ai-send-scene', 'aria-hidden': 'true' }, [
          h('div', { class: 'ai-send-piece' }, [h(Icon, { name: 'duplicate' }), 'Copied instructions']),
          h(Icon, { name: 'chevron' }),
          h('div', { class: 'ai-send-chat' }, [
            h('div', { class: 'ai-send-chat-heading' }, [h(Icon, { name: 'ai' }), 'Your AI conversation']),
            h('div', { class: 'ai-send-bubble' }, [h(Icon, { name: 'document' }), 'Paste instructions here']),
            h('div', { class: 'ai-send-reply' }, [h(Icon, { name: 'check' }), 'AI replies']),
          ]),
        ]),
        h('div', { class: 'ai-send-directions' }, [
          h('strong', 'Back in the same AI chat:'),
          h('ol', [h('li', 'Paste the copied instructions and send them.'), h('li', 'Wait for the AI to finish, then return here with its new response.')]),
        ]),
        h('div', { class: 'study-ai-actions' }, [
          h('button', { type: 'button', class: 'card-primary-button', onClick: () => emit('retry') }, 'I sent the instructions — next'),
          h('a', { class: 'quiet-button ai-exchange-open-link', href: 'https://chatgpt.com/', target: '_blank', rel: 'noopener noreferrer' }, 'Open ChatGPT'),
        ]),
      ] : [
        h('div', { class: 'study-ai-actions' }, [
          h('button', { type: 'button', class: 'card-primary-button', disabled: copying.value,
            onClick: () => { void copy(props.repairPrompt); } }, props.batchOnly ? 'Copy instructions for another batch' : 'Copy instructions to fix the response'),
          props.accepted ? h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('review') }, 'Continue with ' + props.accepted + ' questions') : null,
        ]),
        fallback.value ? h('div', [
          h('p', { role: 'status' }, 'Copying was blocked. Copy these instructions manually.'),
          h('textarea', { readonly: true, rows: 5, value: fallback.value, 'aria-label': 'Repair instructions' }),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { copied.value = true; fallback.value = ''; } }, 'I copied the instructions'),
        ]) : null,
        props.batchPrompt ? h('details', { class: 'review-ai-warning-details' }, [
          h('summary', 'AI struggling with a large request?'),
          h('p', 'Try asking for a smaller batch. You can add the new questions to the draft.'),
          h('button', { type: 'button', class: 'quiet-button', disabled: copying.value, onClick: () => { void copy(props.batchPrompt); } }, 'Copy smaller request'),
        ]) : null,
      ],
      copied.value && props.accepted ? h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('review') }, 'Continue with ' + props.accepted + ' questions instead') : null,
      !props.batchOnly && (props.report.issues.length || props.report.notices.length) ? h('details', { class: 'review-ai-warning-details' }, [
        h('summary', 'What went wrong?'),
        h('ul', [...props.report.issues.map(issue => (issue.item ? 'Question ' + issue.item + ': ' : '') + issue.message), ...props.report.notices].map(message => h('li', message))),
      ]) : null,
      h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back to response'),
    ]);
  },
});
