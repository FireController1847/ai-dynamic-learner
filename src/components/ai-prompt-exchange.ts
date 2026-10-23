import { defineComponent, h, nextTick, onBeforeUnmount, ref, Transition } from 'vue';
import { inputValue } from '../core/dom.ts';
import { Icon } from './icon.ts';
import { AiSourceIntro } from './ai-source-intro.ts';

export interface AiPromptExchangeHandle { showImport(): void }

/** Manual AI handoff. The feature supplies its own prompt, validator and preview. */
export const AiPromptExchange = defineComponent({
  name: 'AiPromptExchange',
  props: {
    idPrefix: { type: String, required: true },
    prompt: { type: String, required: true },
    promptHelp: { type: String, required: true },
    importHelp: { type: String, required: true },
    label: { type: String, required: true },
    json: { type: String, default: '' },
    problem: { type: String, default: '' },
    maxLength: { type: Number, default: undefined },
    validateLabel: { type: String, default: 'Check response' },
    hasPreview: Boolean,
    startInImport: Boolean,
    importOnly: Boolean,
    skipSource: Boolean,
  },
  emits: { 'update-json': (_value: string) => true, validate: () => true },
  setup(props, { emit, slots, expose }) {
    const stage = ref<'source' | 'instructions' | 'send' | 'response'>(props.startInImport || props.importOnly ? 'response' : props.skipSource ? 'instructions' : 'source');
    const shown = ref(false);
    const errorMessage = ref('');
    const input = ref<HTMLTextAreaElement | null>(null);
    const stepHeading = ref<HTMLElement | null>(null);
    const promptText = ref<HTMLTextAreaElement | null>(null);
    const preview = ref<HTMLElement | null>(null);
    let disposed = false;
    let focusResponse = false;
    onBeforeUnmount(() => { disposed = true; });

    function selectResponse() {
      focusResponse = true;
      stage.value = 'response';
      if (stage.value === 'response') nextTick(() => input.value?.focus({ preventScroll: true }));
    }
    function selectInstructions() {
      if (props.importOnly) return;
      stage.value = 'instructions';
      errorMessage.value = '';
    }

    function selectSource() {
      if (props.importOnly || props.skipSource) return;
      stage.value = 'source';
      errorMessage.value = '';
    }
    expose({ showImport: selectResponse });

    async function copy() {
      errorMessage.value = '';
      try {
        await navigator.clipboard.writeText(props.prompt);
        if (disposed) return;
        focusResponse = true;
        stage.value = 'send';
      } catch {
        if (disposed) return;
        shown.value = true;
        errorMessage.value = 'Copying was blocked. Select and copy the instructions shown below instead.';
        await nextTick();
        promptText.value?.focus();
        promptText.value?.select();
      }
    }

    function confirmCopied() {
      errorMessage.value = '';
      stage.value = 'send';
    }

    function afterStepEnter() {
      if (focusResponse && stage.value === 'response') {
        focusResponse = false;
        input.value?.focus({ preventScroll: true });
      } else stepHeading.value?.focus({ preventScroll: true });
    }

    return () => h('div', { class: 'ai-exchange' }, [
      props.importOnly ? null : h('div', { class: 'ai-exchange-progress', 'aria-label': 'AI creation progress' }, [
        !props.skipSource ? h('span', { class: stage.value === 'source' ? 'is-active' : 'is-complete', 'aria-current': stage.value === 'source' ? 'step' : undefined }, '1 · Source') : null,
        !props.skipSource ? h(Icon, { name: 'chevron' }) : null,
        h('span', { class: stage.value === 'instructions' ? 'is-active' : stage.value === 'send' || stage.value === 'response' ? 'is-complete' : '', 'aria-current': stage.value === 'instructions' ? 'step' : undefined }, props.skipSource ? '1 · Copy' : '2 · Copy'),
        h(Icon, { name: 'chevron' }),
        h('span', { class: stage.value === 'send' ? 'is-active' : stage.value === 'response' ? 'is-complete' : '', 'aria-current': stage.value === 'send' ? 'step' : undefined }, props.skipSource ? '2 · Send' : '3 · Send'),
        h(Icon, { name: 'chevron' }),
        h('span', { class: stage.value === 'response' ? 'is-active' : '', 'aria-current': stage.value === 'response' ? 'step' : undefined }, props.skipSource ? '3 · Return' : '4 · Return'),
      ]),
      h('div', { class: 'ai-exchange-frame' }, [
        h(Transition, { name: 'ai-exchange-panel', mode: 'out-in', onAfterEnter: afterStepEnter }, {
          default: () => h('section', {
            key: stage.value, class: 'ai-exchange-panel',
            'aria-labelledby': props.idPrefix + '-step-title',
          }, stage.value === 'source' && !props.importOnly ? [
            h('div', { class: 'ai-exchange-step-heading' }, [
              h('h3', { id: props.idPrefix + '-step-title', ref: stepHeading, tabindex: -1 }, 'Give your AI something to study'),
              h('p', { class: 'ai-exchange-help' }, 'Open your AI chat and share the material you want to learn from.'),
            ]),
            h(AiSourceIntro, { showImportShortcut: true, onNext: selectInstructions, onImport: selectResponse }),
          ] : stage.value === 'instructions' && !props.importOnly ? [
            h('div', { class: 'ai-exchange-step-heading' }, [
              h('h3', { id: props.idPrefix + '-step-title' }, 'Make instructions for your AI'),
              h('p', { class: 'ai-exchange-help' }, props.promptHelp),
            ]),
            slots.options?.(),
            slots.guidance?.(),
            h('div', { class: 'ai-exchange-actions' }, [
              h('button', { type: 'button', class: 'card-primary-button ai-exchange-copy', onClick: copy }, [
                h(Icon, { name: 'duplicate' }), 'Copy instructions for your AI',
              ]),
              h('button', { type: 'button', class: 'quiet-button',
                'aria-expanded': shown.value, 'aria-controls': props.idPrefix + '-prompt',
                onClick: () => { shown.value = !shown.value; },
              }, [h(Icon, { name: shown.value ? 'chevron-up' : 'chevron-down' }), shown.value ? 'Hide instructions' : 'View instructions']),
            ]),
            errorMessage.value ? h('p', { class: 'ai-exchange-error', role: 'alert' }, errorMessage.value) : null,
            h(Transition, { name: 'ai-exchange-reveal' }, {
              default: () => shown.value ? h('textarea', {
                ref: promptText, id: props.idPrefix + '-prompt', readonly: true,
                value: props.prompt, rows: 10, 'aria-label': props.label + ' AI instructions',
              }) : null,
            }),
            errorMessage.value ? h('button', { type: 'button', class: 'quiet-button', onClick: confirmCopied }, 'I copied the instructions') : null,
            h('div', { class: 'ai-exchange-secondary' }, [
              !props.skipSource ? h('button', { type: 'button', class: 'ai-exchange-link', onClick: selectSource }, 'Back to source') : null,
            ]),
          ] : stage.value === 'send' && !props.importOnly ? [
            h('div', { class: 'ai-exchange-step-heading' }, [
              h('h3', { id: props.idPrefix + '-step-title' }, 'Send the instructions to your AI'),
              h('p', { class: 'ai-exchange-help' }, 'Your instructions are copied. They have NOT been sent to ChatGPT or any other AI yet.'),
            ]),
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
              h('strong', 'Back in the same chat where you sent your notes:'),
              h('ol', [h('li', 'Paste the copied instructions into the message box.'), h('li', 'Send the message and let your AI finish answering.')]),
            ]),
            h('div', { class: 'ai-exchange-actions' }, [
              h('button', { type: 'button', class: 'card-primary-button', onClick: selectResponse }, 'I sent the instructions — next'),
              h('a', { class: 'quiet-button ai-exchange-open-link', href: 'https://chatgpt.com/', target: '_blank', rel: 'noopener noreferrer' }, [h(Icon, { name: 'ai' }), 'Open ChatGPT', h(Icon, { name: 'chevron' })]),
            ]),
            h('button', { type: 'button', class: 'ai-exchange-link', onClick: selectInstructions }, 'Back to instructions'),
          ] : [
            h('div', { class: 'ai-exchange-step-heading' }, [
              h('h3', { id: props.idPrefix + '-step-title' },
                props.hasPreview ? 'Review your generated content' : 'Paste your AI’s reply here'),
              h('p', { class: 'ai-exchange-help' }, props.importHelp),
            ]),
            !props.hasPreview ? h('div', { class: 'ai-response-path', 'aria-label': 'Final import steps' }, [
              h('span', [h(Icon, { name: 'duplicate' }), '1. Copy the complete AI reply']),
              h(Icon, { name: 'chevron' }),
              h('span', [h(Icon, { name: 'check' }), '2. Check and preview it']),
            ]) : null,
            h('label', { class: 'ai-exchange-field-label', for: props.idPrefix + '-response' }, 'AI response'),
            h('textarea', {
              ref: input, id: props.idPrefix + '-response', value: props.json,
              rows: 9, maxlength: props.maxLength,
              placeholder: 'Paste everything your AI generated here (including the code block)',
              'aria-invalid': props.problem ? 'true' : undefined,
              'aria-describedby': props.problem ? props.idPrefix + '-error' : undefined,
              onInput: (event: Event) => { emit('update-json', inputValue(event)); },
            }),
            props.problem ? h('p', { id: props.idPrefix + '-error', role: 'alert', class: 'ai-exchange-error' }, [
              h('strong', 'That response could not be used. '), props.problem,
            ]) : null,
            h('div', { class: 'ai-exchange-actions' }, [
              h('button', { type: 'button', class: 'card-primary-button', disabled: !props.json.trim(), onClick: () => emit('validate') },
                props.hasPreview ? 'Check again' : props.validateLabel),
              !props.importOnly ? h('button', { type: 'button', class: 'quiet-button', onClick: () => { stage.value = 'send'; } }, 'Back to AI chat step') : null,
            ]),
            h('details', { class: 'ai-exchange-format-help' }, [
              h('summary', 'Having trouble with the response?'),
              h('p', 'Ask your AI to return only the requested response format, without extra explanation. Dynamic Learner reads structured data (JSON) behind the scenes; you only need to copy and paste it.'),
            ]),
            h(Transition, { name: 'ai-exchange-reveal', onAfterEnter: () => preview.value?.focus({ preventScroll: false }) }, {
              default: () => props.hasPreview ? h('div', {
                ref: preview, class: 'ai-exchange-preview', role: 'region',
                'aria-label': props.label + ' preview', tabindex: -1,
              }, slots.preview?.()) : null,
            }),
          ]),
        }),
      ]),
    ]);
  },
});
