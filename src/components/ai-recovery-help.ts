import { defineComponent, h, ref, type PropType } from 'vue';
import { Icon } from './icon.ts';
import type { AiRecoveryReport } from '../core/ai-response-recovery.ts';

function explanation(message: string): string {
  if (/generated for .* importing it into /i.test(message)) return message;
  if (/unsupported.*version|format version/i.test(message)) return 'This response uses an unsupported version. Ask your AI to regenerate it in the current app format.';
  if (/different.*format|not a supported|format mismatch/i.test(message)) return 'This response has a different format. Check which app and mode created it, then generate a response for this importer.';
  if (/truncat|cut off|ended|incomplete/i.test(message)) return 'The AI response appears incomplete. Keep the valid items and request the missing portion, or a smaller complete response.';
  if (/json|comma|bracket|syntax|parse/i.test(message)) return 'The AI returned malformed JSON. Request one valid JSON file, with corrected quotes, commas, and brackets.';
  if (/required|missing|field|schema/i.test(message)) return 'The AI left out a required field or used an unsupported structure. Request a corrected response using the original prompt.';
  return message;
}

/** A separate guided repair step, never shown during a successful ordinary import. */
export const AiRecoveryHelp = defineComponent({
  name: 'AiRecoveryHelp',
  props: {
    report: { type: Object as PropType<AiRecoveryReport>, required: true },
    accepted: { type: Number, required: true },
    repairPrompt: { type: String, required: true },
    batchPrompt: { type: String, default: '' },
    batchOnly: Boolean,
    itemLabel: { type: String, default: 'questions' },
    canContinue: { type: Boolean, default: true },
    appendRepair: { type: Boolean, default: true },
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
    return () => h('section', { class: 'ai-repair-step', 'aria-label': 'Recover your AI response' }, [
      h('h3', props.batchOnly ? 'Add more ' + props.itemLabel : props.accepted ? props.accepted + ' ' + props.itemLabel + (props.canContinue ? ' are ready!' : ' recovered') : 'Your AI response needs a quick fix'),
      h('p', props.batchOnly ? 'Keep your existing content and ask the AI for another small batch.' : props.accepted
        ? props.report.issues.length ? 'We kept the content that could be read. Some of the response still needs attention.' : 'We recovered the usable content. You can continue, or ask the AI for a corrected response.'
        : 'We couldn’t read the response yet. This can happen when the AI sends an incomplete or incorrectly formatted reply. You don’t need to fix it yourself.'),
      props.report.issues.length ? h('p', { class: 'study-ai-muted', role: 'status' }, explanation(props.report.issues[0].message)) : null,
      props.accepted && !props.canContinue ? h('p', 'The recovered items are not yet enough to create a valid set. Return a corrected response to finish.') : null,
      props.accepted && !props.appendRepair ? h('p', { class: 'study-ai-muted' }, 'The AI needs to return the complete corrected response to preserve its relationships and settings.') : null,
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
          h('button', { type: 'button', class: props.report.issues.length || !props.canContinue ? 'card-primary-button' : 'quiet-button', disabled: copying.value,
            onClick: () => { void copy(props.repairPrompt); } }, props.batchOnly ? 'Copy instructions for another batch' : 'Copy instructions to fix the response'),
          props.accepted && props.canContinue ? h('button', { type: 'button', class: props.report.issues.length ? 'quiet-button' : 'card-primary-button', onClick: () => emit('review') }, 'Continue with ' + props.accepted + ' ' + props.itemLabel) : null,
        ]),
        fallback.value ? h('div', [
          h('p', { role: 'status' }, 'Copying was blocked. Copy these instructions manually.'),
          h('textarea', { readonly: true, rows: 5, value: fallback.value, 'aria-label': 'Repair instructions' }),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { copied.value = true; fallback.value = ''; } }, 'I copied the instructions'),
        ]) : null,
        props.batchPrompt ? h('details', { class: 'ai-exchange-format-help' }, [
          h('summary', 'AI struggling with a large request?'),
          h('p', 'Try asking for a smaller batch. You can add the new content to the draft.'),
          h('button', { type: 'button', class: 'quiet-button', disabled: copying.value, onClick: () => { void copy(props.batchPrompt); } }, 'Copy smaller request'),
        ]) : null,
      ],
      copied.value && props.accepted && props.canContinue ? h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('review') }, 'Continue with ' + props.accepted + ' ' + props.itemLabel + ' instead') : null,
      !props.batchOnly && (props.report.issues.length || props.report.notices.length) ? h('details', { class: 'ai-exchange-format-help' }, [
        h('summary', 'What went wrong?'),
        h('ul', [...props.report.issues.map(issue => (issue.item ? (props.itemLabel === 'questions' ? 'Question ' : 'Item ') + issue.item + ': ' : '') + issue.message), ...props.report.notices].map(message => h('li', message))),
      ]) : null,
      h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back to response'),
    ]);
  },
});
